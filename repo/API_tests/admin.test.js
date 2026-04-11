const { request, createAdminUser } = require('./helpers');

describe('Admin API', () => {
  let adminToken;
  let regularToken;

  beforeAll(async () => {
    // Admin must be provisioned through a controlled path, not self-registration
    const admin = await createAdminUser();
    adminToken = admin.token;

    const regular = await request('POST', '/api/auth/register', { username: `reg_${Date.now()}`, email: `r${Date.now()}@t.com`, password: 'RegPass123!' });
    regularToken = regular.data.token;
  });

  test('Admin self-registration is rejected', async () => {
    const res = await request('POST', '/api/auth/register', {
      username: `selfadmin_${Date.now()}`,
      email: `sa${Date.now()}@t.com`,
      password: 'SelfAdmin123!',
      role: 'admin',
    });
    expect(res.status).toBe(400);
  });

  test('Non-admin cannot access admin routes', async () => {
    const res = await request('GET', '/api/admin/users', null, regularToken);
    expect(res.status).toBe(403);
  });

  test('GET /api/admin/users lists users (admin)', async () => {
    const res = await request('GET', '/api/admin/users', null, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();
    expect(res.data.total).toBeGreaterThan(0);
  });

  test('GET /api/admin/audit returns audit logs (admin)', async () => {
    const res = await request('GET', '/api/admin/audit', null, adminToken);
    expect(res.status).toBe(200);
  });

  test('GET /api/admin/content-reviews returns pending reviews (admin)', async () => {
    const res = await request('GET', '/api/admin/content-reviews', null, adminToken);
    expect(res.status).toBe(200);
  });

  test('Error responses have structured format with no stack traces', async () => {
    const res = await request('GET', '/api/admin/users', null, regularToken);
    expect(res.data.code).toBe(403);
    expect(res.data.msg).toBeDefined();
    expect(typeof res.data.msg).toBe('string');
    const body = JSON.stringify(res.data);
    expect(body).not.toContain('at ');
    expect(body).not.toContain('.js:');
    expect(body).not.toContain('node_modules');
  });
});
