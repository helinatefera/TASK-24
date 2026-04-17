const { request, createAdminUser } = require('./helpers');

describe('Admin Extended Routes', () => {
  let adminToken;
  let regularUserId, regularToken;

  beforeAll(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    const ts = Date.now();
    const regular = await request('POST', '/api/auth/register', {
      username: `admExt_${ts}`, email: `ae${ts}@t.com`, password: 'AePass1234!',
    });
    regularToken = regular.data.token;
    regularUserId = regular.data.user._id;
  });

  // --- User role/status changes ---

  test('PATCH /api/admin/users/:id/role changes user role', async () => {
    const res = await request('PATCH', `/api/admin/users/${regularUserId}/role`, {
      role: 'photographer',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.role).toBe('photographer');
  });

  test('PATCH /api/admin/users/:id/role with invalid role → 400', async () => {
    const res = await request('PATCH', `/api/admin/users/${regularUserId}/role`, {
      role: 'superuser',
    }, adminToken);
    expect(res.status).toBe(400);
  });

  test('Non-admin cannot change role → 403', async () => {
    const res = await request('PATCH', `/api/admin/users/${regularUserId}/role`, {
      role: 'admin',
    }, regularToken);
    expect(res.status).toBe(403);
  });

  test('PATCH /api/admin/users/:id/status changes account status', async () => {
    const res = await request('PATCH', `/api/admin/users/${regularUserId}/status`, {
      accountStatus: 'suspended',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.accountStatus).toBe('suspended');
  });

  test('PATCH /api/admin/users/:id/status reactivates user', async () => {
    const res = await request('PATCH', `/api/admin/users/${regularUserId}/status`, {
      accountStatus: 'active',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.accountStatus).toBe('active');
  });

  // --- Blacklist delete ---

  test('POST + DELETE /api/admin/blacklist roundtrip', async () => {
    const createRes = await request('POST', '/api/admin/blacklist', {
      targetType: 'account',
      targetId: regularUserId,
      reason: 'Test blacklist entry',
    }, adminToken);
    expect(createRes.status).toBe(201);
    const entryId = createRes.data._id;

    const deleteRes = await request('DELETE', `/api/admin/blacklist/${entryId}`, null, adminToken);
    expect(deleteRes.status).toBe(200);
  });

  // --- Privacy policies listing ---

  test('POST + GET /api/admin/privacy-policies roundtrip', async () => {
    const ts = Date.now();
    const createRes = await request('POST', '/api/admin/privacy-policies', {
      version: `ae_v_${ts}`,
      content: 'Admin extended test policy',
      effectiveDate: new Date().toISOString(),
      purposes: ['marketing'],
    }, adminToken);
    expect(createRes.status).toBe(201);

    const listRes = await request('GET', '/api/admin/privacy-policies', null, adminToken);
    expect(listRes.status).toBe(200);
    const items = listRes.data.items || listRes.data || [];
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  // --- Sensitive words listing and deletion ---

  test('POST + GET + DELETE /api/admin/sensitive-words roundtrip', async () => {
    const createRes = await request('POST', '/api/admin/sensitive-words', {
      word: `testword_${Date.now()}`,
      severity: 'low',
    }, adminToken);
    expect(createRes.status).toBe(201);
    const wordId = createRes.data._id;

    const listRes = await request('GET', '/api/admin/sensitive-words', null, adminToken);
    expect(listRes.status).toBe(200);
    const items = listRes.data.items || listRes.data || [];
    expect(items.length).toBeGreaterThanOrEqual(1);

    const deleteRes = await request('DELETE', `/api/admin/sensitive-words/${wordId}`, null, adminToken);
    expect(deleteRes.status).toBe(200);
  });

  test('Non-admin cannot list sensitive words → 403', async () => {
    const res = await request('GET', '/api/admin/sensitive-words', null, regularToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot list privacy policies → 403', async () => {
    const res = await request('GET', '/api/admin/privacy-policies', null, regularToken);
    expect(res.status).toBe(403);
  });
});
