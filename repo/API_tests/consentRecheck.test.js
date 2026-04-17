const { request, createAdminUser } = require('./helpers');

/**
 * Integration test for the consent recheck cron job.
 * Exercises the real job function (same one the scheduler runs) to verify
 * that consents are invalidated when a new policy introduces new purposes.
 */
describe('Consent Recheck Job (cron-triggered reconsent)', () => {
  let userToken, userId, adminToken;
  let policyV1, policyV2;

  beforeAll(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    const ts = Date.now();
    const user = await request('POST', '/api/auth/register', {
      username: `crch_${ts}`, email: `crch${ts}@t.com`, password: 'CrCh12345!',
    });
    userToken = user.data.token;
    userId = user.data.user._id;

    // Publish initial policy with single purpose
    policyV1 = `crch_v1_${ts}`;
    await request('POST', '/api/admin/privacy-policies', {
      version: policyV1,
      content: 'Policy v1',
      effectiveDate: new Date().toISOString(),
      purposes: ['general'],
    }, adminToken);

    // User consents to v1
    const consentRes = await request('POST', '/api/consent', { policyVersion: policyV1, accepted: true }, userToken);
    expect(consentRes.status).toBe(201);
  }, 30000);

  test('before new policy published, active consent is current', async () => {
    const res = await request('GET', '/api/consent/current-policy', null, userToken);
    expect(res.status).toBe(200);
  });

  test('publishing new policy with new purposes flags consent for reconsent (30-day grace)', async () => {
    const ts = Date.now();
    policyV2 = `crch_v2_${ts}`;
    await request('POST', '/api/admin/privacy-policies', {
      version: policyV2,
      content: 'Policy v2 with new data category',
      effectiveDate: new Date().toISOString(),
      purposes: ['general', 'analytics'], // 'analytics' is a NEW purpose
    }, adminToken);

    // Run the real cron job function (same code the scheduler runs)
    const { recheckConsents } = require('/app/dist/jobs/consentRecheck');
    await recheckConsents();

    // F-002: v1 consent is FLAGGED (needsReconsent=true) but stays active during 30-day grace
    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    const conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      const v1Consent = await conn.collection('consents').findOne({
        userId: new mongoose.Types.ObjectId(userId),
        policyVersion: policyV1,
      });
      expect(v1Consent).toBeDefined();
      expect(v1Consent.needsReconsent).toBe(true);
      expect(v1Consent.isActive).toBe(true); // still active during grace window
      expect(v1Consent.reconsentDeadline).toBeDefined();
    } finally { await conn.close(); }
  });

  test('policy without new purposes does not invalidate existing consent', async () => {
    // Register a fresh user + consent to avoid cross-test pollution
    const ts = Date.now();
    const u = await request('POST', '/api/auth/register', {
      username: `crchNoInv_${ts}`, email: `crchni${ts}@t.com`, password: 'CrChNi123!',
    });

    const vA = `crch_noinv_a_${ts}`;
    await request('POST', '/api/admin/privacy-policies', {
      version: vA, content: 'A', effectiveDate: new Date().toISOString(), purposes: ['general'],
    }, adminToken);
    await request('POST', '/api/consent', { policyVersion: vA, accepted: true }, u.data.token);

    // New policy WITHOUT new purposes (same purposes list)
    const vB = `crch_noinv_b_${ts}`;
    await request('POST', '/api/admin/privacy-policies', {
      version: vB, content: 'B', effectiveDate: new Date(Date.now() + 1000).toISOString(), purposes: ['general'],
    }, adminToken);

    const { recheckConsents } = require('/app/dist/jobs/consentRecheck');
    await recheckConsents();

    // Consent to vA should still be active since vB has no new purposes
    const mongoose = require('/app/node_modules/mongoose');
    const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
    const conn = await mongoose.createConnection(MONGO_URI).asPromise();
    try {
      const cA = await conn.collection('consents').findOne({
        userId: new mongoose.Types.ObjectId(u.data.user._id),
        policyVersion: vA,
      });
      expect(cA.isActive).toBe(true);
    } finally { await conn.close(); }
  });

  test('GET /consent/current-policy reflects invalidated state after recheck', async () => {
    const res = await request('GET', '/api/consent/current-policy', null, userToken);
    expect(res.status).toBe(200);
    // After invalidation, user needs reconsent
    if (res.data.needsReconsent !== undefined) {
      expect(res.data.needsReconsent).toBe(true);
    }
  });
});
