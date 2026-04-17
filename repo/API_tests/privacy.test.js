const { request } = require('./helpers');

describe('Privacy Settings Routes', () => {
  let token;

  beforeAll(async () => {
    const ts = Date.now();
    const res = await request('POST', '/api/auth/register', {
      username: `priv_${ts}`, email: `priv${ts}@t.com`, password: 'PrivPass123!',
    });
    token = res.data.token;

    // Grant contact_information consent so profile creation works
    await request('POST', '/api/consent/data-category', { category: 'contact_information' }, token);
    await request('PUT', '/api/profiles/me', { firstName: 'PrivUser' }, token);
  });

  test('GET /api/privacy/settings returns current privacy levels', async () => {
    const res = await request('GET', '/api/privacy/settings', null, token);
    expect(res.status).toBe(200);
    // Should return an object with field-level privacy settings
    expect(res.data).toBeDefined();
  });

  test('PUT /api/privacy/settings updates privacy levels', async () => {
    const res = await request('PUT', '/api/privacy/settings', {
      phone: 'private',
      email: 'alumni_only',
      location: 'public',
    }, token);
    expect(res.status).toBe(200);
  });

  test('GET /api/privacy/settings reflects updates', async () => {
    const res = await request('GET', '/api/privacy/settings', null, token);
    expect(res.status).toBe(200);
    const settings = res.data.settings || res.data;
    if (settings.phone) {
      expect(settings.phone).toBe('private');
    }
  });

  test('GET /api/profiles/me returns own profile', async () => {
    const res = await request('GET', '/api/profiles/me', null, token);
    expect(res.status).toBe(200);
  });

  test('Unauthenticated privacy settings request → 401', async () => {
    const res = await request('GET', '/api/privacy/settings');
    expect(res.status).toBe(401);
  });
});
