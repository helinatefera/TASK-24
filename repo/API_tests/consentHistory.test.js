const { request, createAdminUser } = require('./helpers');

describe('Consent History & Policy Endpoints', () => {
  let userToken;
  let adminToken;
  let policyVersion;

  beforeAll(async () => {
    const ts = Date.now();
    const user = await request('POST', '/api/auth/register', {
      username: `ch_${ts}`, email: `ch${ts}@t.com`, password: 'ChPass1234!',
    });
    userToken = user.data.token;

    const admin = await createAdminUser();
    adminToken = admin.token;

    // Create a privacy policy
    policyVersion = `ch_v_${ts}`;
    await request('POST', '/api/admin/privacy-policies', {
      version: policyVersion,
      content: 'Consent history test policy',
      effectiveDate: new Date().toISOString(),
      purposes: ['analytics'],
    }, adminToken);

    // Record a consent
    await request('POST', '/api/consent', { policyVersion, accepted: true }, userToken);
  });

  test('GET /api/consent/history returns user consent records', async () => {
    const res = await request('GET', '/api/consent/history', null, userToken);
    expect(res.status).toBe(200);
    const items = res.data.items || res.data || [];
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/consent/current-policy returns latest policy', async () => {
    const res = await request('GET', '/api/consent/current-policy', null, userToken);
    expect(res.status).toBe(200);
  });

  test('GET /api/consent/policy-history returns all policy versions', async () => {
    const res = await request('GET', '/api/consent/policy-history', null, userToken);
    expect(res.status).toBe(200);
    const items = res.data.items || res.data || [];
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('Unauthenticated consent history → 401', async () => {
    const res = await request('GET', '/api/consent/history');
    expect(res.status).toBe(401);
  });
});
