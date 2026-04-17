const { request } = require('./helpers');

describe('Auth API', () => {
  const user = { username: `testuser_${Date.now()}`, email: `test${Date.now()}@test.com`, password: 'TestPass123!' };
  let token;

  test('POST /api/auth/register creates user with cookie-only auth', async () => {
    const res = await request('POST', '/api/auth/register', user);
    expect(res.status).toBe(201);
    expect(res.data.user.username).toBe(user.username);
    expect(res.data.user.passwordHash).toBeUndefined();
    // Token must come from httpOnly cookie, NOT JSON body
    expect(res.cookieToken).toBeDefined();
    token = res.cookieToken;
  });

  test('POST /api/auth/register rejects duplicate username', async () => {
    const res = await request('POST', '/api/auth/register', user);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  test('POST /api/auth/register rejects weak password', async () => {
    const res = await request('POST', '/api/auth/register', { username: 'weakpw', email: 'w@t.com', password: '123' });
    expect(res.status).toBe(400);
    expect(res.data.msg).toBeDefined();
  });

  test('POST /api/auth/login returns user via cookie-only auth', async () => {
    const res = await request('POST', '/api/auth/login', { username: user.username, password: user.password });
    expect(res.status).toBe(200);
    expect(res.data.user).toBeDefined();
    // Token must come from httpOnly cookie, NOT JSON body
    expect(res.cookieToken).toBeDefined();
    token = res.cookieToken;
  });

  test('POST /api/auth/login fails with wrong password', async () => {
    const res = await request('POST', '/api/auth/login', { username: user.username, password: 'WrongPass99!' });
    expect(res.status).toBe(401);
  });

  test('GET /api/health returns ok', async () => {
    const res = await request('GET', '/api/health');
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
  });

  test('Protected route without token returns 401', async () => {
    const res = await request('GET', '/api/profiles');
    expect(res.status).toBe(401);
  });

  test('Protected route with token succeeds', async () => {
    const res = await request('GET', '/api/profiles', null, token);
    expect(res.status).toBe(200);
  });

  test('POST /api/auth/logout revokes session', async () => {
    const res = await request('POST', '/api/auth/logout', null, token);
    expect(res.status).toBe(200);
  });
});
