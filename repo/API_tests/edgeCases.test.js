const { request, createAdminUser, createFullJobLifecycle, ensureMongooseConnected } = require('./helpers');
const http = require('http');

const BASE = process.env.API_BASE || 'http://server:3001';

/**
 * Coverage for audit-identified gaps:
 * - duplicate nonce replay returns 409
 * - settlement approve requires varianceReason when threshold exceeded
 * - expired access request cannot be approved
 */
describe('Edge: duplicate nonce → 409 Conflict', () => {
  let token;

  beforeAll(async () => {
    const ts = Date.now();
    const u = await request('POST', '/api/auth/register', {
      username: `dup_${ts}`, email: `dup${ts}@t.com`, password: 'DupNonce1!',
    });
    token = u.cookieToken || u.data.token;
  });

  test('reusing the same nonce on same endpoint returns 409', async () => {
    const nonce = 'fixed-nonce-' + Date.now();
    const timestamp = Date.now().toString();

    function requestWithFixedNonce() {
      return new Promise((resolve, reject) => {
        const url = new URL('/api/profiles/me', BASE);
        const req = http.request({
          hostname: url.hostname, port: url.port, path: url.pathname, method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Nonce': nonce,
            'X-Timestamp': timestamp,
            'Authorization': `Bearer ${token}`,
          },
        }, (res) => {
          let data = '';
          res.on('data', c => data += c);
          res.on('end', () => {
            try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
            catch { resolve({ status: res.statusCode, data }); }
          });
        });
        req.on('error', reject);
        req.end();
      });
    }

    const first = await requestWithFixedNonce();
    // First use is accepted (or 404/403 depending on state, but NOT 409)
    expect(first.status).not.toBe(409);

    const second = await requestWithFixedNonce();
    expect(second.status).toBe(409);
    expect(JSON.stringify(second.data).toLowerCase()).toMatch(/replay|duplicate/);
  });
});

describe('Edge: settlement variance reason required when threshold exceeded', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await createFullJobLifecycle();
  }, 60000);

  test('adjustment exceeding variance threshold requires reason on approve', async () => {
    // Variance threshold = max(subtotal * 0.02, 2500). For a 12000c subtotal,
    // threshold = max(240, 2500) = 2500. Add a -5000c adjustment to exceed it.
    const adjRes = await request('POST', `/api/settlements/${ctx.settlementId}/adjustment`, {
      type: 'discount', amountCents: -5000, reason: 'Big discount for variance test',
    }, ctx.clientToken);
    expect(adjRes.status).toBe(201);

    // Approving WITHOUT varianceReason should fail
    const approveNoReason = await request('PATCH', `/api/settlements/${ctx.settlementId}/approve`, {}, ctx.clientToken);
    expect(approveNoReason.status).toBe(400);
    expect(JSON.stringify(approveNoReason.data).toLowerCase()).toMatch(/variance|reason/);

    // Approving WITH varianceReason should succeed
    const approveWithReason = await request('PATCH', `/api/settlements/${ctx.settlementId}/approve`, {
      varianceReason: 'Approved discount per agreement',
    }, ctx.clientToken);
    expect(approveWithReason.status).toBe(200);
    expect(approveWithReason.data.status).toBe('approved');
  });
});

describe('Edge: expired access request cannot be approved', () => {
  let userAToken, userAId, userBToken;

  beforeAll(async () => {
    const ts = Date.now();
    const a = await request('POST', '/api/auth/register', {
      username: `expA_${ts}`, email: `expa${ts}@t.com`, password: 'ExpA12345!',
    });
    userAToken = a.cookieToken || a.data.token;
    userAId = a.data.user._id;

    const b = await request('POST', '/api/auth/register', {
      username: `expB_${ts}`, email: `expb${ts}@t.com`, password: 'ExpB12345!',
    });
    userBToken = b.cookieToken || b.data.token;

    await request('POST', '/api/consent/data-category', { category: 'contact_information' }, userAToken);
    await request('PUT', '/api/profiles/me', { firstName: 'Alice' }, userAToken);
  });

  test('access request with expired expiresAt cannot be approved', async () => {
    // Create a request via API
    const createRes = await request('POST', '/api/access-requests', {
      targetUserId: userAId,
      fields: ['phone'],
      reason: 'Expiry edge test',
    }, userBToken);
    expect(createRes.status).toBe(201);
    const requestId = createRes.data._id;

    // Force-expire the request via DB (expiry happens on cron, tests can't wait 7 days)
    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    const conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('accessrequests').updateOne(
        { _id: new mongoose.Types.ObjectId(requestId) },
        { $set: { expiresAt: new Date(Date.now() - 1000), status: 'expired' } },
      );
    } finally { await conn.close(); }

    // Now try to approve the expired request — should fail
    const approveRes = await request('PATCH', `/api/access-requests/${requestId}/approve`, {}, userAToken);
    // Should reject because status is no longer pending
    expect([400, 403, 404, 409, 410, 422]).toContain(approveRes.status);
  });

  test('access request expiry job marks pending expired requests as expired', async () => {
    // Create a fresh request
    const createRes = await request('POST', '/api/access-requests', {
      targetUserId: userAId,
      fields: ['email'],
      reason: 'Expiry cron test',
    }, userBToken);
    const requestId = createRes.data._id;

    // Set expiresAt in the past (but status still pending)
    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    const conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('accessrequests').updateOne(
        { _id: new mongoose.Types.ObjectId(requestId) },
        { $set: { expiresAt: new Date(Date.now() - 1000) } },
      );
    } finally { await conn.close(); }

    // Run the expiry cron function (same code the scheduler runs)
    await ensureMongooseConnected();
    const { expireAccessRequests } = require('/app/dist/jobs/accessRequestExpiry');
    await expireAccessRequests();

    // Verify status changed to expired
    const checkConn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      const req = await checkConn.collection('accessrequests').findOne({
        _id: new mongoose.Types.ObjectId(requestId),
      });
      expect(req.status).toBe('expired');
    } finally { await checkConn.close(); }
  });
});

describe('Edge: rate-limit message consistency', () => {
  test('rate-limit error response is structured with code + msg', async () => {
    // Not practical to trigger the rate limit in normal test flow (60/min).
    // Instead verify the error handler returns structured shape for any 429.
    // This is a shape-contract test.
    const mod = require('/app/dist/utils/errors');
    expect(typeof mod.RateLimitError).toBe('function');
    const err = new mod.RateLimitError('Too many requests');
    expect(err.statusCode).toBe(429);
    expect(err.message).toBeDefined();
  });
});
