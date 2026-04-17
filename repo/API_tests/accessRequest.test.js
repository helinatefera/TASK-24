const { request, createAdminUser } = require('./helpers');

describe('Access Request Routes', () => {
  let userAToken, userAId;
  let userBToken, userBId;
  let requestId;

  beforeAll(async () => {
    const ts = Date.now();
    const a = await request('POST', '/api/auth/register', {
      username: `arA_${ts}`, email: `arA${ts}@t.com`, password: 'ArAPass123!',
    });
    userAToken = a.data.token;
    userAId = a.data.user._id;

    const b = await request('POST', '/api/auth/register', {
      username: `arB_${ts}`, email: `arB${ts}@t.com`, password: 'ArBPass123!',
    });
    userBToken = b.data.token;
    userBId = b.data.user._id;

    // Grant contact_information consent for both users so profile writes work
    await request('POST', '/api/consent/data-category', { category: 'contact_information' }, userAToken);
    await request('POST', '/api/consent/data-category', { category: 'contact_information' }, userBToken);

    // Create profiles
    await request('PUT', '/api/profiles/me', { firstName: 'Alice', phone: '555-0001' }, userAToken);
    await request('PUT', '/api/profiles/me', { firstName: 'Bob', phone: '555-0002' }, userBToken);
  });

  test('POST /api/access-requests creates a request', async () => {
    const res = await request('POST', '/api/access-requests', {
      targetUserId: userAId,
      fields: ['phone', 'email'],
      reason: 'Need to contact for project',
    }, userBToken);
    expect(res.status).toBe(201);
    requestId = res.data._id;
    expect(requestId).toBeDefined();
  });

  test('POST /api/access-requests without fields → 400', async () => {
    const res = await request('POST', '/api/access-requests', {
      targetUserId: userAId,
      reason: 'Missing fields',
    }, userBToken);
    expect(res.status).toBe(400);
  });

  test('GET /api/access-requests/outgoing lists sent requests', async () => {
    const res = await request('GET', '/api/access-requests/outgoing', null, userBToken);
    expect(res.status).toBe(200);
    const items = res.data.items || res.data || [];
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/access-requests/incoming lists received requests', async () => {
    const res = await request('GET', '/api/access-requests/incoming', null, userAToken);
    expect(res.status).toBe(200);
    const items = res.data.items || res.data || [];
    const found = items.find(r => r._id === requestId);
    expect(found).toBeDefined();
  });

  test('PATCH /api/access-requests/:id/approve approves request', async () => {
    const res = await request('PATCH', `/api/access-requests/${requestId}/approve`, {}, userAToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('approved');
  });

  test('PATCH /api/access-requests/:id/deny on new request denies it', async () => {
    // Create another request then deny it
    const createRes = await request('POST', '/api/access-requests', {
      targetUserId: userAId,
      fields: ['location'],
      reason: 'Nearby check',
    }, userBToken);
    expect(createRes.status).toBe(201);
    const newId = createRes.data._id;

    const res = await request('PATCH', `/api/access-requests/${newId}/deny`, {}, userAToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('denied');
  });

  test('PATCH /api/access-requests/:id/respond with status=approved works', async () => {
    // Create a fresh request and use the generic respond route
    const createRes = await request('POST', '/api/access-requests', {
      targetUserId: userAId,
      fields: ['email'],
      reason: 'Generic respond test',
    }, userBToken);
    expect(createRes.status).toBe(201);
    const newId = createRes.data._id;

    const res = await request('PATCH', `/api/access-requests/${newId}/respond`, {
      status: 'approved',
    }, userAToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('approved');
  });

  test('Unauthenticated access-request → 401', async () => {
    const res = await request('GET', '/api/access-requests/incoming');
    expect(res.status).toBe(401);
  });
});
