const { request, createAdminUser, submitReportWithEvidence } = require('./helpers');

describe('H-02: Consent Contract & Enforcement', () => {
  let userToken, userId;
  let adminToken;
  let policyVersion;

  beforeAll(async () => {
    const ts = Date.now();
    const user = await request('POST', '/api/auth/register', {
      username: `h02User_${ts}`, email: `h02u${ts}@t.com`, password: 'ConPass123!',
    });
    userToken = user.data.token;
    userId = user.data.user._id;

    const admin = await createAdminUser();
    adminToken = admin.token;

    policyVersion = `v_${ts}`;
    await request('POST', '/api/admin/privacy-policies', {
      version: policyVersion,
      content: 'Test policy for consent tests',
      effectiveDate: new Date().toISOString(),
      purposes: ['general'],
    }, adminToken);
  });

  // --- Schema validation ---

  test('Recording consent with policyVersion succeeds', async () => {
    const res = await request('POST', '/api/consent', { policyVersion, accepted: true }, userToken);
    expect(res.status).toBe(201);
    expect(res.data.policyVersion).toBe(policyVersion);
  });

  test('Recording consent without policyVersion → 400', async () => {
    const res = await request('POST', '/api/consent', { accepted: true }, userToken);
    expect(res.status).toBe(400);
  });

  test('Recording consent with non-existent policyVersion → 404', async () => {
    const res = await request('POST', '/api/consent', { policyVersion: 'nonexistent_999', accepted: true }, userToken);
    expect(res.status).toBe(404);
  });

  // --- Data category enum validation ---

  test('Granting valid category succeeds with normalized response', async () => {
    const res = await request('POST', '/api/consent/data-category', { category: 'contact_information' }, userToken);
    expect(res.status).toBe(201);
    expect(res.data.category).toBe('contact_information');
    expect(res.data.dataCategory).toBe('contact_information');
  });

  test('Granting invalid category → 400', async () => {
    const res = await request('POST', '/api/consent/data-category', { category: 'invalid_xxx' }, userToken);
    expect(res.status).toBe(400);
  });

  test('Active consents returned with normalized category field', async () => {
    const res = await request('GET', '/api/consent/data-category', null, userToken);
    expect(res.status).toBe(200);
    const items = res.data.items || res.data || [];
    const found = items.find(c => c.category === 'contact_information');
    expect(found).toBeDefined();
    expect(found.dataCategory).toBe('contact_information');
  });

  test('GET /data-categories returns authoritative list with all 7 categories', async () => {
    const res = await request('GET', '/api/consent/data-categories', null, userToken);
    expect(res.status).toBe(200);
    expect(res.data.categories).toContain('account_identity');
    expect(res.data.categories).toContain('government_id');
    expect(res.data.categories.length).toBe(7);
  });

  test('Revoking valid active category succeeds', async () => {
    const res = await request('DELETE', '/api/consent/data-category/contact_information', null, userToken);
    expect(res.status).toBe(200);
    expect(res.data.category).toBe('contact_information');
  });

  test('Revoking invalid category → 400', async () => {
    const res = await request('DELETE', '/api/consent/data-category/invalid_xxx', null, userToken);
    expect(res.status).toBe(400);
  });

  // --- Consent enforcement: writes blocked without consent ---

  test('Profile update with contact data blocked without consent → 403', async () => {
    // Ensure contact_information consent is revoked
    await request('DELETE', '/api/consent/data-category/contact_information', null, userToken).catch(() => {});
    const res = await request('PUT', '/api/profiles/me', { phone: '555-1234' }, userToken);
    expect(res.status).toBe(403);
    expect(res.data.msg).toContain('contact_information');
  });

  test('Profile update with contact data succeeds after granting consent', async () => {
    await request('POST', '/api/consent/data-category', { category: 'contact_information' }, userToken);
    const res = await request('PUT', '/api/profiles/me', { phone: '555-1234' }, userToken);
    expect([200, 404]).toContain(res.status); // 404 if no profile exists yet, but NOT 403
  });

  test('Report creation blocked without account_identity consent → 403', async () => {
    // Ensure account_identity consent is NOT granted
    await request('DELETE', '/api/consent/data-category/account_identity', null, userToken).catch(() => {});
    const res = await submitReportWithEvidence(userToken, {
      targetUserId: userId, category: 'spam', description: 'Test report',
    });
    expect(res.status).toBe(403);
    expect(res.data.msg).toContain('account_identity');
  });

  test('Report creation succeeds after granting account_identity consent', async () => {
    await request('POST', '/api/consent/data-category', { category: 'account_identity' }, userToken);
    const res = await submitReportWithEvidence(userToken, {
      targetUserId: userId, category: 'spam', description: 'Test report after consent',
    });
    expect(res.status).toBe(201);
  });

  // --- All valid categories accepted ---

  const validCategories = [
    'account_identity', 'contact_information', 'employer_information',
    'government_id', 'tax_forms', 'qualification_documents', 'device_fingerprint',
  ];

  test.each(validCategories)('Category "%s" is accepted', async (category) => {
    const res = await request('POST', '/api/consent/data-category', { category }, userToken);
    expect(res.status).toBe(201);
  });
});
