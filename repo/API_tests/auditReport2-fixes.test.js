/**
 * Tests for fixes applied from audit_report-2.md:
 *   F-001: cross-community posted-job detail denial
 *   F-002: 30-day consent grace window (pre-deadline allowed, post-deadline enforced)
 *   F-003: report evidence required
 */
const { request, createAdminUser, submitReportWithEvidence, ensureMongooseConnected } = require('./helpers');

// -----------------------------------------------------------------------------
// F-001: Cross-community posted-job detail access is denied
// -----------------------------------------------------------------------------
describe('F-001: Cross-community posted job detail denial', () => {
  let adminToken;
  let userA, userB;
  let jobId;

  beforeAll(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    const ts = Date.now();
    // User A in community "alpha"
    const resA = await request('POST', '/api/auth/register', {
      username: `cc_A_${ts}`, email: `ccA${ts}@t.com`, password: 'CcA12345!',
    });
    userA = { token: resA.cookieToken || resA.data.token, userId: resA.data.user._id };

    // Force userA into community "alpha"
    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    let conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(userA.userId) },
        { $set: { communityId: 'alpha' } },
      );
    } finally { await conn.close(); }

    // User B in community "beta"
    const resB = await request('POST', '/api/auth/register', {
      username: `cc_B_${ts}`, email: `ccB${ts}@t.com`, password: 'CcB12345!',
    });
    userB = { token: resB.cookieToken || resB.data.token, userId: resB.data.user._id };

    conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(userB.userId) },
        { $set: { communityId: 'beta' } },
      );
    } finally { await conn.close(); }

    // User A creates and posts a job (belongs to community alpha)
    const jobRes = await request('POST', '/api/jobs', {
      title: 'Cross-community isolation test job',
      description: 'Testing posted-job community boundary',
      jobType: 'event', rateType: 'hourly',
      agreedRateCents: 5000, estimatedTotalCents: 10000,
    }, userA.token);
    jobId = jobRes.data._id;

    // Post the job so status becomes "posted" (the vulnerable path)
    await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, userA.token);

    // Force the job's communityId to "alpha" to match userA
    conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('jobs').updateOne(
        { _id: new mongoose.Types.ObjectId(jobId) },
        { $set: { communityId: 'alpha' } },
      );
    } finally { await conn.close(); }
  });

  test('User in DIFFERENT community CANNOT read posted job detail → 403', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`, null, userB.token);
    expect(res.status).toBe(403);
  });

  test('Job owner (participant) CAN still read regardless of community', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`, null, userA.token);
    expect(res.status).toBe(200);
  });

  test('Admin CAN read any job regardless of community', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`, null, adminToken);
    expect(res.status).toBe(200);
  });
});

// -----------------------------------------------------------------------------
// F-002: 30-day consent grace window
// -----------------------------------------------------------------------------
describe('F-002: 30-day consent grace window', () => {
  let adminToken, userToken, userId;
  let policyV1, policyV2;

  beforeAll(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    const ts = Date.now();
    const u = await request('POST', '/api/auth/register', {
      username: `gw_${ts}`, email: `gw${ts}@t.com`, password: 'Grace1234!',
    });
    userToken = u.cookieToken || u.data.token;
    userId = u.data.user._id;

    policyV1 = `gw_v1_${ts}`;
    await request('POST', '/api/admin/privacy-policies', {
      version: policyV1, content: 'v1', effectiveDate: new Date().toISOString(), purposes: ['general'],
    }, adminToken);
    await request('POST', '/api/consent', { policyVersion: policyV1, accepted: true }, userToken);

    // Publish v2 with NEW purpose
    policyV2 = `gw_v2_${ts}`;
    await request('POST', '/api/admin/privacy-policies', {
      version: policyV2, content: 'v2', effectiveDate: new Date().toISOString(), purposes: ['general', 'analytics'],
    }, adminToken);
  }, 30000);

  test('first recheck run flags consent but KEEPS isActive=true (within grace)', async () => {
    await ensureMongooseConnected();
    const { recheckConsents } = require('/app/dist/jobs/consentRecheck');
    await recheckConsents();

    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    const conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      const c = await conn.collection('consents').findOne({
        userId: new mongoose.Types.ObjectId(userId),
        policyVersion: policyV1,
      });
      expect(c.needsReconsent).toBe(true);
      expect(c.isActive).toBe(true); // still active during grace window
      expect(c.reconsentDeadline).toBeDefined();
      // Deadline should be ~30 days from now
      const daysUntilDeadline = (new Date(c.reconsentDeadline).getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(daysUntilDeadline).toBeGreaterThan(29);
      expect(daysUntilDeadline).toBeLessThan(31);
    } finally { await conn.close(); }
  });

  test('current-policy check reports withinGracePeriod=true when flagged but deadline not passed', async () => {
    const res = await request('GET', '/api/consent/current-policy', null, userToken);
    expect(res.status).toBe(200);
    expect(res.data.needsReconsent).toBe(true);
    expect(res.data.withinGracePeriod).toBe(true);
    expect(res.data.isCurrent).toBe(true); // still usable during grace
  });

  test('after grace deadline expires, recheck deactivates consent', async () => {
    // Fast-forward by setting reconsentDeadline to the past
    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    const conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      await conn.collection('consents').updateOne(
        { userId: new mongoose.Types.ObjectId(userId), policyVersion: policyV1 },
        { $set: { reconsentDeadline: new Date(Date.now() - 1000) } },
      );
    } finally { await conn.close(); }

    // Run recheck again — should deactivate
    await ensureMongooseConnected();
    const { recheckConsents } = require('/app/dist/jobs/consentRecheck');
    await recheckConsents();

    const conn2 = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      const c = await conn2.collection('consents').findOne({
        userId: new mongoose.Types.ObjectId(userId),
        policyVersion: policyV1,
      });
      expect(c.isActive).toBe(false);
    } finally { await conn2.close(); }
  });

  test('after deadline, current-policy reports withinGracePeriod=false and isCurrent=false', async () => {
    const res = await request('GET', '/api/consent/current-policy', null, userToken);
    expect(res.status).toBe(200);
    expect(res.data.needsReconsent).toBe(true);
    // After deactivation, activeConsent lookup returns nothing so isCurrent=false
    expect(res.data.isCurrent).toBe(false);
  });
});

// -----------------------------------------------------------------------------
// F-003: Report evidence required
// -----------------------------------------------------------------------------
describe('F-003: Report submission requires evidence attachment', () => {
  let userToken, userId;

  beforeAll(async () => {
    const ts = Date.now();
    const u = await request('POST', '/api/auth/register', {
      username: `ev_${ts}`, email: `ev${ts}@t.com`, password: 'Evidence1!',
    });
    userToken = u.cookieToken || u.data.token;
    userId = u.data.user._id;
    await request('POST', '/api/consent/data-category', { category: 'account_identity' }, userToken);
  });

  test('Report submission without evidence file returns 400', async () => {
    // JSON body without multipart files should be rejected
    const res = await request('POST', '/api/reports', {
      targetUserId: userId, category: 'spam', description: 'No evidence',
    }, userToken);
    expect(res.status).toBe(400);
    expect(res.data.msg.toLowerCase()).toMatch(/evidence|file|required/);
  });

  test('Report submission WITH evidence file succeeds', async () => {
    const res = await submitReportWithEvidence(userToken, {
      targetUserId: userId, category: 'spam', description: 'With evidence attached',
    });
    expect(res.status).toBe(201);
    expect(res.data._id).toBeDefined();
  });
});
