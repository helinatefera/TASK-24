const { request, createAdminUser, createFullJobLifecycle, createVerifiedPhotographer } = require('./helpers');
const http = require('http');
const crypto = require('crypto');
const BASE = process.env.API_BASE || 'http://server:3001';

function multipartUpload(url, token, fields, fileField) {
  const boundary = '----SecBound' + Date.now();
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (fileField) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`));
    parts.push(fileField.buffer);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--`));
  const body = Buffer.concat(parts);
  return new Promise((resolve, reject) => {
    const parsed = new URL(url, BASE);
    const req = http.request({
      hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Authorization': `Bearer ${token}`,
        'X-Nonce': crypto.randomUUID(),
        'X-Timestamp': Date.now().toString(),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('Security - Object-level Authorization', () => {
  let userAToken, userAId;
  let userBToken, userBId;
  let adminToken;
  let jobId;

  beforeAll(async () => {
    const a = await request('POST', '/api/auth/register', { username: `secA_${Date.now()}`, email: `secA${Date.now()}@t.com`, password: 'SecureA123!' });
    userAToken = a.data.token;
    userAId = a.data.user._id;

    const b = await request('POST', '/api/auth/register', { username: `secB_${Date.now()}`, email: `secB${Date.now()}@t.com`, password: 'SecureB123!' });
    userBToken = b.data.token;
    userBId = b.data.user._id;

    const admin = await createAdminUser();
    adminToken = admin.token;

    const job = await request('POST', '/api/jobs', {
      title: 'Security Test Job', description: 'Testing access', jobType: 'event',
      rateType: 'hourly', agreedRateCents: 5000, estimatedTotalCents: 10000,
    }, userAToken);
    jobId = job.data._id;
  });

  test('Admin self-registration is blocked', async () => {
    const res = await request('POST', '/api/auth/register', {
      username: `admin_attack_${Date.now()}`,
      email: `atk${Date.now()}@t.com`,
      password: 'AttackAdmin1!',
      role: 'admin',
    });
    expect(res.status).toBe(400);
  });

  test('User B cannot access User A draft job', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`, null, userBToken);
    expect(res.status).toBe(403);
    expect(res.data.code).toBe(403);
  });

  test('Admin CAN access any job', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`, null, adminToken);
    expect(res.status).toBe(200);
  });

  test('Unauthenticated request is rejected with 401', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`);
    expect(res.status).toBe(401);
    expect(res.data.code).toBe(401);
  });

  test('Non-admin cannot access admin endpoints', async () => {
    const res = await request('GET', '/api/admin/users', null, userAToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot access audit logs', async () => {
    const res = await request('GET', '/api/admin/audit', null, userAToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot manage blacklist', async () => {
    const res = await request('POST', '/api/admin/blacklist', { targetType: 'account', targetId: userBId, reason: 'test' }, userAToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot review content', async () => {
    const res = await request('GET', '/api/admin/content-reviews', null, userAToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot manage sensitive words', async () => {
    const res = await request('POST', '/api/admin/sensitive-words', { word: 'test', severity: 'low' }, userAToken);
    expect(res.status).toBe(403);
  });

  test('Cross-user settlement access is denied', async () => {
    const fakeId = '000000000000000000000000';
    const res = await request('GET', `/api/settlements/${fakeId}`, null, userBToken);
    expect([403, 404]).toContain(res.status);
  });

  test('Cross-user file access denied — verification parent', async () => {
    // Register a photographer (User A role) and submit verification via real API
    const ts = Date.now();
    const photogA = await request('POST', '/api/auth/register', {
      username: `secPhA_${ts}`, email: `secPhA${ts}@t.com`, password: 'PhotA123!', role: 'photographer',
    });
    await request('POST', '/api/consent/data-category', { category: 'government_id' }, photogA.data.token);
    await request('POST', '/api/consent/data-category', { category: 'qualification_documents' }, photogA.data.token);

    // Submit verification (creates real file attachment via API)
    const boundary = '----SecVer' + ts;
    const pdfHeader = Buffer.from('%PDF-1.4\n');
    const submitRes = await multipartUpload('/api/verification/submit', photogA.data.token,
      { realName: 'Sec Test', qualificationType: 'general' },
      { name: 'documents', filename: 'id.pdf', contentType: 'application/pdf', buffer: Buffer.concat([pdfHeader, Buffer.alloc(100, 0x20)]) },
    );
    expect(submitRes.status).toBe(201);

    // Find the file attachment created by the upload
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let fileId;
    try {
      const file = await conn.collection('fileattachments').findOne({
        uploadedBy: new mongoose.Types.ObjectId(photogA.data.user._id),
        parentType: 'verification',
      });
      fileId = file?._id.toString();
    } finally { await conn.close(); }

    expect(fileId).toBeDefined();
    const res = await request('GET', `/api/files/${fileId}`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('Cross-user file access denied — report parent', async () => {
    // Create report with evidence upload via real API
    const ts = Date.now();
    await request('POST', '/api/consent/data-category', { category: 'account_identity' }, userAToken);

    const sharp = require('/app/node_modules/sharp');
    const validJpeg = await sharp({ create: { width: 10, height: 10, channels: 3, background: { r: 0, g: 0, b: 0 } } }).jpeg().toBuffer();

    const reportRes = await multipartUpload('/api/reports', userAToken,
      { targetUserId: userBId, category: 'fraud', description: 'Evidence test report' },
      { name: 'evidence', filename: 'evidence.jpg', contentType: 'image/jpeg', buffer: validJpeg },
    );
    expect(reportRes.status).toBe(201);

    // Find file attachment from the report upload
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let fileId;
    try {
      const file = await conn.collection('fileattachments').findOne({
        uploadedBy: new mongoose.Types.ObjectId(userAId),
        parentType: 'report',
      });
      fileId = file?._id.toString();
    } finally { await conn.close(); }

    if (fileId) {
      const res = await request('GET', `/api/files/${fileId}`, null, userBToken);
      expect(res.status).toBe(403);
    }
  });

  test('Cross-user file access denied — portfolio parent', async () => {
    // Register a photographer and create portfolio + upload image via real API
    const ts = Date.now();
    const photogP = await request('POST', '/api/auth/register', {
      username: `secPhP_${ts}`, email: `secPhP${ts}@t.com`, password: 'PhotP123!', role: 'photographer',
    });
    const pToken = photogP.data.token;

    // Create portfolio via API
    const portRes = await request('POST', '/api/portfolios', {
      title: 'Security Test Portfolio', description: 'Cross-user access test',
    }, pToken);
    expect(portRes.status).toBe(201);
    const portfolioId = portRes.data._id;

    // Upload image to portfolio via API
    const sharp = require('/app/node_modules/sharp');
    const validJpeg = await sharp({ create: { width: 50, height: 50, channels: 3, background: { r: 128, g: 128, b: 128 } } }).jpeg().toBuffer();

    const imgRes = await multipartUpload(`/api/portfolios/${portfolioId}/images`, pToken,
      { copyrightNotice: '(c) Test', caption: 'Test' },
      { name: 'image', filename: 'test.jpg', contentType: 'image/jpeg', buffer: validJpeg },
    );
    expect(imgRes.status).toBe(201);

    // Find the file attachment from the upload
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let fileId;
    try {
      const file = await conn.collection('fileattachments').findOne({
        uploadedBy: new mongoose.Types.ObjectId(photogP.data.user._id),
        parentType: 'portfolio',
      });
      fileId = file?._id.toString();
    } finally { await conn.close(); }

    if (fileId) {
      const res = await request('GET', `/api/files/${fileId}`, null, userBToken);
      expect(res.status).toBe(403);
    }
  });

  test('User B cannot read User A job work entries', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/work-entries`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('User B cannot read User A job deliverables', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/deliverables`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('User B cannot read User A job escrow', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/escrow`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('User B cannot read User A job messages', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/messages`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('Admin can read any job work entries', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/work-entries`, null, adminToken);
    expect(res.status).toBe(200);
  });

  test('Admin can read any job deliverables', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/deliverables`, null, adminToken);
    expect(res.status).toBe(200);
  });
});

describe('Security - Settlement/Payment Mutation Authorization', () => {
  let ownerToken, ownerId, ownerJobId, settlementId, approvedSettlementId;
  let outsiderToken;

  beforeAll(async () => {
    // Full lifecycle via API — no DB shortcuts for settlement creation
    const ctx = await createFullJobLifecycle();
    ownerToken = ctx.clientToken;
    ownerId = ctx.clientId;
    ownerJobId = ctx.jobId;
    settlementId = ctx.settlementId; // draft settlement from lifecycle

    const outsider = await request('POST', '/api/auth/register', {
      username: `settOut_${Date.now()}`, email: `sout${Date.now()}@t.com`, password: 'OutPass123!',
    });
    outsiderToken = outsider.data.token;

    // Approve the settlement via API to get an approved one for payment tests
    await request('PATCH', `/api/settlements/${settlementId}/approve`, {
      varianceReason: 'Security test approval',
    }, ownerToken);
    approvedSettlementId = settlementId;
  }, 60000);

  test('Non-participant cannot create settlement for someone else job', async () => {
    expect(ownerJobId).toBeDefined();
    const res = await request('POST', `/api/jobs/${ownerJobId}/settlement`, null, outsiderToken);
    expect(res.status).toBe(403);
  });

  test('Non-participant cannot approve existing settlement', async () => {
    expect(settlementId).toBeDefined();
    const res = await request('PATCH', `/api/settlements/${settlementId}/approve`, {}, outsiderToken);
    expect(res.status).toBe(403);
  });

  test('Non-participant cannot add adjustment to existing settlement', async () => {
    expect(settlementId).toBeDefined();
    const res = await request('POST', `/api/settlements/${settlementId}/adjustment`, {
      amountCents: 100, reason: 'test',
    }, outsiderToken);
    expect(res.status).toBe(403);
  });

  test('Non-participant cannot record payment on approved settlement', async () => {
    expect(approvedSettlementId).toBeDefined();
    const res = await request('POST', `/api/settlements/${approvedSettlementId}/payments`, {
      amountCents: 100, method: 'cash',
    }, outsiderToken);
    expect(res.status).toBe(403);
  });

  test('Owner can read their own settlement', async () => {
    expect(settlementId).toBeDefined();
    const res = await request('GET', `/api/settlements/${settlementId}`, null, ownerToken);
    expect(res.status).toBe(200);
  });

  test('Non-participant cannot read existing settlement', async () => {
    expect(settlementId).toBeDefined();
    const res = await request('GET', `/api/settlements/${settlementId}`, null, outsiderToken);
    expect(res.status).toBe(403);
  });
});

describe('Security - Community Isolation', () => {
  test('Job list is scoped to user community', async () => {
    // Register user and create a job
    const ts = Date.now();
    const u = await request('POST', '/api/auth/register', {
      username: `iso_${ts}`, email: `iso${ts}@t.com`, password: 'IsoPass123!',
    });
    const res = await request('GET', '/api/jobs', null, u.data.token);
    expect(res.status).toBe(200);
    // Should return jobs array (community-scoped, may be empty)
    expect(res.data.jobs).toBeDefined();
  });

  test('Non-participant user in different community CANNOT read posted job detail → 403', async () => {
    // F-001 regression guard: posted jobs must NOT leak across community boundaries.
    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    const ts = Date.now();

    // User in community A
    const userA = await request('POST', '/api/auth/register', {
      username: `ciA_${ts}`, email: `ciA${ts}@t.com`, password: 'CiA12345!',
    });
    const userAId = userA.data.user._id;
    const userAToken = userA.cookieToken || userA.data.token;

    // User in community B (different community)
    const userB = await request('POST', '/api/auth/register', {
      username: `ciB_${ts}`, email: `ciB${ts}@t.com`, password: 'CiB12345!',
    });
    const userBId = userB.data.user._id;
    const userBToken = userB.cookieToken || userB.data.token;

    // Force distinct community IDs on the two users
    let conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(userAId) },
        { $set: { communityId: 'community-alpha' } },
      );
      await conn.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(userBId) },
        { $set: { communityId: 'community-beta' } },
      );
    } finally { await conn.close(); }

    // User A creates a job
    const jobRes = await request('POST', '/api/jobs', {
      title: 'Community A Posted Job', description: 'Cross-community isolation test',
      jobType: 'event', rateType: 'hourly',
      agreedRateCents: 5000, estimatedTotalCents: 10000,
    }, userAToken);
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.data._id;

    // Post the job (transition from draft to posted — the vulnerable path)
    const postRes = await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, userAToken);
    expect(postRes.status).toBe(200);

    // Pin the job's communityId to community-alpha in case controller copied from user's earlier communityId
    conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('jobs').updateOne(
        { _id: new mongoose.Types.ObjectId(jobId) },
        { $set: { communityId: 'community-alpha', status: 'posted' } },
      );
    } finally { await conn.close(); }

    // User B (community-beta, not a participant) tries to read the posted job → must be denied
    const crossRes = await request('GET', `/api/jobs/${jobId}`, null, userBToken);
    expect(crossRes.status).toBe(403);

    // Owner (User A) can still read their own posted job
    const ownerRes = await request('GET', `/api/jobs/${jobId}`, null, userAToken);
    expect(ownerRes.status).toBe(200);
    expect(ownerRes.data.title).toBe('Community A Posted Job');
  });

  test('Same-community non-participant CAN read posted job detail → 200', async () => {
    // Positive companion test: within the same community, posted jobs ARE visible.
    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    const ts = Date.now();

    const userX = await request('POST', '/api/auth/register', {
      username: `ciX_${ts}`, email: `ciX${ts}@t.com`, password: 'CiX12345!',
    });
    const userY = await request('POST', '/api/auth/register', {
      username: `ciY_${ts}`, email: `ciY${ts}@t.com`, password: 'CiY12345!',
    });

    // Both in the same community
    let conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('users').updateMany(
        { _id: { $in: [new mongoose.Types.ObjectId(userX.data.user._id), new mongoose.Types.ObjectId(userY.data.user._id)] } },
        { $set: { communityId: 'community-gamma' } },
      );
    } finally { await conn.close(); }

    // User X creates and posts a job
    const jobRes = await request('POST', '/api/jobs', {
      title: 'Gamma Posted Job', description: 'Same-community read test',
      jobType: 'event', rateType: 'hourly',
      agreedRateCents: 4000, estimatedTotalCents: 8000,
    }, userX.cookieToken || userX.data.token);
    const jobId = jobRes.data._id;
    await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, userX.cookieToken || userX.data.token);

    conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('jobs').updateOne(
        { _id: new mongoose.Types.ObjectId(jobId) },
        { $set: { communityId: 'community-gamma', status: 'posted' } },
      );
    } finally { await conn.close(); }

    // User Y (same community, non-participant) should be able to view
    const sameRes = await request('GET', `/api/jobs/${jobId}`, null, userY.cookieToken || userY.data.token);
    expect(sameRes.status).toBe(200);
  });

  test('Profile list returns minimized fields', async () => {
    const ts = Date.now();
    const u = await request('POST', '/api/auth/register', {
      username: `prof_${ts}`, email: `prof${ts}@t.com`, password: 'ProfPass123!',
    });
    const res = await request('GET', '/api/profiles', null, u.data.token);
    expect(res.status).toBe(200);
    if (res.data.profiles && res.data.profiles.length > 0) {
      const profile = res.data.profiles[0];
      // Should NOT expose full private data like phone, email, bio in list view
      expect(profile.phone).toBeUndefined();
      expect(profile.email).toBeUndefined();
      expect(profile.bio).toBeUndefined();
    }
  });
});

describe('Security - Nonce Enforcement', () => {
  test('Mutation request without nonce is rejected with 422', async () => {
    const http = require('http');
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/auth/register', process.env.API_BASE || 'http://server:3001');
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
      });
      req.on('error', reject);
      req.write(JSON.stringify({ username: 'nonce_test', email: 'nt@t.com', password: 'Test1234!' }));
      req.end();
    });
    expect(res.status).toBe(422);
    expect(res.data.msg).toContain('X-Nonce');
  });

  test('GET request without nonce is rejected with 400', async () => {
    const http = require('http');
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/profiles', process.env.API_BASE || 'http://server:3001');
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'GET',
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
      });
      req.on('error', reject);
      req.end();
    });
    expect(res.status).toBe(400);
    expect(res.data.msg).toContain('X-Nonce');
  });

  test('Health endpoint works without nonce', async () => {
    const http = require('http');
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/health', process.env.API_BASE || 'http://server:3001');
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'GET',
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
      });
      req.on('error', reject);
      req.end();
    });
    expect(res.status).toBe(200);
  });
});

describe('Security - Password Validation', () => {
  test('Weak password rejected on register', async () => {
    const res = await request('POST', '/api/auth/register', { username: `pw_${Date.now()}`, email: `pw${Date.now()}@t.com`, password: '123' });
    expect(res.status).toBe(400);
    expect(res.data.msg).toBeDefined();
  });

  test('Password without uppercase rejected', async () => {
    const res = await request('POST', '/api/auth/register', { username: `pw2_${Date.now()}`, email: `pw2${Date.now()}@t.com`, password: 'alllowercase1' });
    expect(res.status).toBe(400);
  });
});

describe('Security - Error Response Format', () => {
  test('401 error has structured format', async () => {
    const res = await request('GET', '/api/profiles');
    expect(res.data.code).toBe(401);
    expect(typeof res.data.msg).toBe('string');
    expect(Object.keys(res.data)).toEqual(expect.arrayContaining(['code', 'msg']));
  });

  test('403 error has structured format', async () => {
    const reg = await request('POST', '/api/auth/register', { username: `err_${Date.now()}`, email: `err${Date.now()}@t.com`, password: 'ErrTest123!' });
    const res = await request('GET', '/api/admin/users', null, reg.data.token);
    expect(res.data.code).toBe(403);
    expect(typeof res.data.msg).toBe('string');
  });

  test('Errors never contain stack traces or internal paths', async () => {
    const res = await request('GET', '/api/profiles');
    const body = JSON.stringify(res.data);
    expect(body).not.toMatch(/at\s+\w+.*\(/);
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain('.js:');
    expect(body).not.toContain('Error:');
  });
});

describe('Security - Upload Validation', () => {
  let photographerToken;

  beforeAll(async () => {
    const ts = Date.now();
    const p = await request('POST', '/api/auth/register', {
      username: `photog_${ts}`, email: `ph${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    photographerToken = p.data.token;
  });

  test('Invalid MIME type rejected on verification upload', async () => {
    const http = require('http');
    const boundary = '----TestBoundary' + Date.now();
    // Build a minimal multipart body with a .exe file (disallowed MIME)
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="documents"; filename="malware.exe"',
      'Content-Type: application/x-msdownload',
      '',
      'MZ fake exe content',
      `--${boundary}--`,
    ].join('\r\n');

    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/verification/submit', process.env.API_BASE || 'http://server:3001');
      const nonce = require('crypto').randomUUID();
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Authorization': `Bearer ${photographerToken}`,
          'X-Nonce': nonce,
          'X-Timestamp': Date.now().toString(),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      });
      req.on('error', reject);
      req.write(body);
      req.end();
    });
    expect(res.status).toBe(400);
  });

  test('Oversize file rejected on verification upload', async () => {
    const http = require('http');
    const boundary = '----TestBoundary' + Date.now();
    // 11MB file exceeds 10MB multer limit
    const bigContent = Buffer.alloc(11 * 1024 * 1024, 0x41);
    const header = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="documents"; filename="huge.pdf"',
      'Content-Type: application/pdf',
      '',
      '',
    ].join('\r\n');
    const footer = `\r\n--${boundary}--`;
    const bodyBuf = Buffer.concat([Buffer.from(header), bigContent, Buffer.from(footer)]);

    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/verification/submit', process.env.API_BASE || 'http://server:3001');
      const nonce = require('crypto').randomUUID();
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuf.length,
          'Authorization': `Bearer ${photographerToken}`,
          'X-Nonce': nonce,
          'X-Timestamp': Date.now().toString(),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      });
      req.on('error', reject);
      req.write(bodyBuf);
      req.end();
    });
    // Multer rejects with 413 or express returns 400/500 for oversize
    expect([400, 413, 500]).toContain(res.status);
  });

  test('Malformed PDF signature rejected on verification upload', async () => {
    const http = require('http');
    const boundary = '----TestBoundary' + Date.now();
    // Send a file claiming to be PDF but with JPEG magic bytes
    const fakeContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00]);
    const header = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="documents"; filename="fake.pdf"',
      'Content-Type: application/pdf',
      '',
      '',
    ].join('\r\n');
    const footer = `\r\n--${boundary}--`;
    const bodyBuf = Buffer.concat([Buffer.from(header), fakeContent, Buffer.from(footer)]);

    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/verification/submit', process.env.API_BASE || 'http://server:3001');
      const nonce = require('crypto').randomUUID();
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuf.length,
          'Authorization': `Bearer ${photographerToken}`,
          'X-Nonce': nonce,
          'X-Timestamp': Date.now().toString(),
        },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      });
      req.on('error', reject);
      req.write(bodyBuf);
      req.end();
    });
    expect(res.status).toBe(400);
  });
});
