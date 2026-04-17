const { request } = require('./helpers');

describe('Auth Extended Routes', () => {
  let token;
  let userId;
  const user = {
    username: `authExt_${Date.now()}`,
    email: `authExt${Date.now()}@t.com`,
    password: 'AuthExtPass1!',
  };

  beforeAll(async () => {
    const res = await request('POST', '/api/auth/register', user);
    token = res.data.token;
    userId = res.data.user._id;
  });

  test('GET /api/auth/me returns current user profile', async () => {
    const res = await request('GET', '/api/auth/me', null, token);
    expect(res.status).toBe(200);
    expect(res.data.username).toBe(user.username);
    expect(res.data._id).toBe(userId);
    // Must not expose passwordHash
    expect(res.data.passwordHash).toBeUndefined();
  });

  test('GET /api/auth/me without token → 401', async () => {
    const res = await request('GET', '/api/auth/me');
    expect(res.status).toBe(401);
  });

  test('GET /api/auth/me returns server-authoritative role', async () => {
    const res = await request('GET', '/api/auth/me', null, token);
    expect(res.status).toBe(200);
    // Role should come from server, not client
    expect(['alumni', 'photographer', 'admin']).toContain(res.data.role);
  });

  test('POST /api/auth/logout then /me → 401', async () => {
    // Login fresh to get a new token
    const loginRes = await request('POST', '/api/auth/login', {
      username: user.username, password: user.password,
    });
    const freshToken = loginRes.data.token;

    // Logout
    const logoutRes = await request('POST', '/api/auth/logout', null, freshToken);
    expect(logoutRes.status).toBe(200);

    // /me should now fail
    const meRes = await request('GET', '/api/auth/me', null, freshToken);
    expect(meRes.status).toBe(401);
  });

  // --- Job messages (POST /api/jobs/:jobId/messages) ---

  test('POST /api/jobs/:id/messages sends a message', async () => {
    // Create a job first
    const jobRes = await request('POST', '/api/jobs', {
      title: 'Auth Ext Message Test', description: 'Testing messages',
      jobType: 'portrait', rateType: 'piece_rate',
      agreedRateCents: 3000, estimatedTotalCents: 6000,
    }, token);
    expect(jobRes.status).toBe(201);
    const jobId = jobRes.data._id;

    const msgRes = await request('POST', `/api/jobs/${jobId}/messages`, {
      text: 'Hello from auth extended test',
    }, token);
    expect(msgRes.status).toBe(201);
  });
});
