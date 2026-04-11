const { request } = require('./helpers');

describe('Profile API', () => {
  let token;
  let userId;

  beforeAll(async () => {
    const reg = await request('POST', '/api/auth/register', { username: `prof_${Date.now()}`, email: `p${Date.now()}@t.com`, password: 'TestPass123!' });
    token = reg.data.token;
    userId = reg.data.user._id;

    // Grant required data-category consents before updating sensitive fields
    await request('POST', '/api/consent/data-category', { category: 'contact_information' }, token);
    await request('POST', '/api/consent/data-category', { category: 'employer_information' }, token);
  });

  test('PUT /api/profiles/me updates profile', async () => {
    const res = await request('PUT', '/api/profiles/me', { firstName: 'John', lastName: 'Doe', phone: '5551234567', employer: 'Acme Corp' }, token);
    expect(res.status).toBe(200);
    expect(res.data.firstName).toBe('John');
  });

  test('PUT /api/profiles/me rejected without consent for sensitive fields', async () => {
    // Register a fresh user who has NOT granted consent
    const ts = Date.now();
    const fresh = await request('POST', '/api/auth/register', { username: `nc_${ts}`, email: `nc${ts}@t.com`, password: 'NoConsent1!' });
    const res = await request('PUT', '/api/profiles/me', { phone: '555000' }, fresh.data.token);
    expect(res.status).toBe(403);
    expect(res.data.msg).toContain('contact_information');
  });

  test('GET /api/profiles/:id returns profile', async () => {
    const res = await request('GET', `/api/profiles/${userId}`, null, token);
    expect(res.status).toBe(200);
    expect(res.data.firstName).toBeDefined();
  });

  test('GET /api/profiles lists profiles', async () => {
    const res = await request('GET', '/api/profiles', null, token);
    expect(res.status).toBe(200);
  });

  test('PUT /api/privacy/settings updates privacy', async () => {
    const res = await request('PUT', '/api/privacy/settings', { phone: 'private', email: 'alumni_only', employer: 'private' }, token);
    expect(res.status).toBe(200);
  });
});
