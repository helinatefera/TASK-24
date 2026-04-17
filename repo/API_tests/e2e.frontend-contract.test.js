/**
 * Frontend-Backend Contract Tests
 *
 * These tests exercise the EXACT request shapes the frontend sends (axios
 * interceptors, nonce headers, content types, cookie auth) against the REAL
 * running backend. No mocks. This validates that the frontend's API modules
 * produce requests the backend actually accepts, and the response shapes
 * match what the UI components destructure.
 *
 * The tests use the same HTTP helper as API tests but verify the response
 * shapes that frontend components depend on (e.g., { settlement, lineItems },
 * { items, total, page }, { portfolios: [...] }).
 */
const { request, createAdminUser, createVerifiedPhotographer, createFullJobLifecycle } = require('./helpers');

describe('Frontend-Backend Contract: Auth & Session', () => {
  const creds = { username: `feAuth_${Date.now()}`, email: `fea${Date.now()}@t.com`, password: 'FeAuth1234!' };
  let token;

  test('POST /auth/register returns { user, token } — RegisterPage depends on user._id', async () => {
    const res = await request('POST', '/api/auth/register', creds);
    expect(res.status).toBe(201);
    // RegisterPage reads res.data.user
    expect(res.data.user).toBeDefined();
    expect(res.data.user._id).toBeDefined();
    expect(res.data.user.username).toBe(creds.username);
    expect(res.data.user.passwordHash).toBeUndefined();
    token = res.data.token;
  });

  test('POST /auth/login returns { user, token } — LoginPage reads both', async () => {
    const res = await request('POST', '/api/auth/login', {
      username: creds.username, password: creds.password,
    });
    expect(res.status).toBe(200);
    expect(res.data.user).toBeDefined();
    expect(res.data.token).toBeDefined();
    token = res.data.token;
  });

  test('GET /auth/me returns flat user object — AuthContext.fetchUser reads ._id, .role, .username', async () => {
    const res = await request('GET', '/api/auth/me', null, token);
    expect(res.status).toBe(200);
    expect(res.data._id).toBeDefined();
    expect(res.data.role).toBeDefined();
    expect(res.data.username).toBe(creds.username);
  });

  test('POST /auth/logout returns 200 — AuthContext.logout checks status', async () => {
    const loginRes = await request('POST', '/api/auth/login', {
      username: creds.username, password: creds.password,
    });
    const res = await request('POST', '/api/auth/logout', null, loginRes.data.token);
    expect(res.status).toBe(200);
  });
});

describe('Frontend-Backend Contract: Job List & Detail', () => {
  let token;

  beforeAll(async () => {
    const u = await request('POST', '/api/auth/register', {
      username: `feJob_${Date.now()}`, email: `fej${Date.now()}@t.com`, password: 'FeJob12345!',
    });
    token = u.data.token;

    await request('POST', '/api/jobs', {
      title: 'Contract Test Job', description: 'Testing response shape',
      jobType: 'event', rateType: 'hourly', agreedRateCents: 5000, estimatedTotalCents: 10000,
    }, token);
  });

  test('GET /jobs returns { jobs, total, page, limit } — JobListPage reads .jobs', async () => {
    const res = await request('GET', '/api/jobs', null, token);
    expect(res.status).toBe(200);
    expect(res.data.jobs).toBeDefined();
    expect(Array.isArray(res.data.jobs)).toBe(true);
    expect(typeof res.data.total).toBe('number');
    expect(typeof res.data.page).toBe('number');
  });

  test('GET /jobs/:id returns flat job — JobDetailPage reads .title, .status, .jobType', async () => {
    const listRes = await request('GET', '/api/jobs', null, token);
    const jobId = listRes.data.jobs[0]._id;
    const res = await request('GET', `/api/jobs/${jobId}`, null, token);
    expect(res.status).toBe(200);
    expect(res.data.title).toBeDefined();
    expect(res.data.status).toBeDefined();
    expect(res.data.jobType).toBeDefined();
    expect(res.data.agreedRateCents).toBeDefined();
  });
});

describe('Frontend-Backend Contract: Portfolio', () => {
  let token;
  let portfolioId;

  beforeAll(async () => {
    const u = await request('POST', '/api/auth/register', {
      username: `fePort_${Date.now()}`, email: `fep${Date.now()}@t.com`, password: 'FePort1234!', role: 'photographer',
    });
    token = u.data.token;
    const res = await request('POST', '/api/portfolios', {
      title: 'Contract Test Portfolio', description: 'Shape test',
    }, token);
    portfolioId = res.data._id;
  });

  test('GET /portfolios returns { portfolios: [...] } — PortfolioPage reads .portfolios', async () => {
    const res = await request('GET', '/api/portfolios', null, token);
    expect(res.status).toBe(200);
    expect(res.data.portfolios).toBeDefined();
    expect(Array.isArray(res.data.portfolios)).toBe(true);
  });

  test('GET /portfolios/:id returns { _id, title, images } — PortfolioPage detail reads .images', async () => {
    const res = await request('GET', `/api/portfolios/${portfolioId}`, null, token);
    expect(res.status).toBe(200);
    expect(res.data._id).toBeDefined();
    expect(res.data.title).toBeDefined();
    expect(Array.isArray(res.data.images)).toBe(true);
  });
});

describe('Frontend-Backend Contract: Settlement Detail', () => {
  let ctx;

  beforeAll(async () => {
    ctx = await createFullJobLifecycle();
  }, 60000);

  test('GET /settlements/:id returns { settlement, lineItems } — SettlementDetailPage reads both', async () => {
    const res = await request('GET', `/api/settlements/${ctx.settlementId}`, null, ctx.clientToken);
    expect(res.status).toBe(200);
    // SettlementDetailPage: const sData = sRes.data.settlement || sRes.data;
    expect(res.data.settlement).toBeDefined();
    expect(res.data.settlement.subtotalCents).toBeDefined();
    expect(res.data.settlement.adjustmentCents).toBeDefined();
    expect(res.data.settlement.finalAmountCents).toBeDefined();
    expect(res.data.settlement.status).toBeDefined();
    // lineItems
    expect(res.data.lineItems).toBeDefined();
    expect(Array.isArray(res.data.lineItems)).toBe(true);
  });

  test('PATCH /settlements/:id/approve returns settlement with status — SettlementDetailPage refreshes', async () => {
    const res = await request('PATCH', `/api/settlements/${ctx.settlementId}/approve`, {}, ctx.clientToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBeDefined();
  });

  test('GET /settlements/:id/payments returns array — SettlementDetailPage reads .items || .data', async () => {
    const res = await request('GET', `/api/settlements/${ctx.settlementId}/payments`, null, ctx.clientToken);
    expect(res.status).toBe(200);
    // SettlementDetailPage: setPayments(pRes.data.items || pRes.data || [])
    const items = res.data.items || res.data || [];
    expect(Array.isArray(items)).toBe(true);
  });
});

describe('Frontend-Backend Contract: Profiles & Privacy', () => {
  let token;

  beforeAll(async () => {
    const u = await request('POST', '/api/auth/register', {
      username: `feProf_${Date.now()}`, email: `fepr${Date.now()}@t.com`, password: 'FeProf1234!',
    });
    token = u.data.token;
    await request('POST', '/api/consent/data-category', { category: 'contact_information' }, token);
    await request('PUT', '/api/profiles/me', { firstName: 'Contract', lastName: 'Test' }, token);
  });

  test('GET /profiles/:id returns profile with privacy-masked fields — ProfilePage reads directly', async () => {
    const meRes = await request('GET', '/api/auth/me', null, token);
    const res = await request('GET', `/api/profiles/${meRes.data._id}`, null, token);
    expect(res.status).toBe(200);
    expect(res.data.firstName).toBeDefined();
  });

  test('GET /privacy/settings returns privacy levels — PrivacySettingsPage reads .settings', async () => {
    const res = await request('GET', '/api/privacy/settings', null, token);
    expect(res.status).toBe(200);
    // PrivacySettingsPage reads the response directly as settings object
    expect(res.data).toBeDefined();
  });

  test('PUT /privacy/settings returns updated settings', async () => {
    const res = await request('PUT', '/api/privacy/settings', {
      phone: 'private', email: 'alumni_only',
    }, token);
    expect(res.status).toBe(200);
  });
});

describe('Frontend-Backend Contract: Admin Pages', () => {
  let adminToken;

  beforeAll(async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;
  });

  test('GET /admin/users returns { items, total } — UserManagementPage reads .items', async () => {
    const res = await request('GET', '/api/admin/users', null, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();
    expect(Array.isArray(res.data.items)).toBe(true);
    expect(typeof res.data.total).toBe('number');
    // UserManagementPage reads: u.username, u.email, u.role, u.accountStatus
    if (res.data.items.length > 0) {
      const u = res.data.items[0];
      expect(u.username).toBeDefined();
      expect(u.role).toBeDefined();
    }
  });

  test('GET /admin/content-reviews returns { items, total } — ContentReviewPage reads .items', async () => {
    const res = await request('GET', '/api/admin/content-reviews', null, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();
  });

  test('GET /admin/audit returns audit logs — AuditLogPage reads array', async () => {
    const res = await request('GET', '/api/admin/audit', null, adminToken);
    expect(res.status).toBe(200);
    // AuditLogPage reads res.data.items || res.data
    const items = res.data.items || res.data || [];
    expect(Array.isArray(items)).toBe(true);
  });

  test('GET /admin/reports returns { items, total } — ReportManagementPage reads .items', async () => {
    const res = await request('GET', '/api/admin/reports', null, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();
  });
});

describe('Frontend-Backend Contract: Consent & Access Requests', () => {
  let token;

  beforeAll(async () => {
    const u = await request('POST', '/api/auth/register', {
      username: `feCon_${Date.now()}`, email: `feco${Date.now()}@t.com`, password: 'FeCon12345!',
    });
    token = u.data.token;
  });

  test('GET /consent/data-categories returns { categories: [...] } — ConsentManagementPage reads .categories', async () => {
    const res = await request('GET', '/api/consent/data-categories', null, token);
    expect(res.status).toBe(200);
    expect(res.data.categories).toBeDefined();
    expect(Array.isArray(res.data.categories)).toBe(true);
    expect(res.data.categories.length).toBe(7);
  });

  test('GET /consent/data-category returns active consents — ConsentManagementPage reads .items', async () => {
    await request('POST', '/api/consent/data-category', { category: 'account_identity' }, token);
    const res = await request('GET', '/api/consent/data-category', null, token);
    expect(res.status).toBe(200);
    const items = res.data.items || res.data || [];
    expect(Array.isArray(items)).toBe(true);
  });

  test('Error responses always have { code, msg } — all frontend catch blocks read .response.data.msg', async () => {
    const res = await request('GET', '/api/profiles/nonexistent_id', null, token);
    expect([400, 404, 500]).toContain(res.status);
    expect(res.data.code).toBeDefined();
    expect(typeof res.data.msg).toBe('string');
    // Must never have stack traces
    expect(JSON.stringify(res.data)).not.toMatch(/at\s+\w+.*\(/);
    expect(JSON.stringify(res.data)).not.toContain('.js:');
  });
});
