const { request, createFullJobLifecycle, submitReportWithEvidence } = require('./helpers');

describe('Settlement Export & Report Retrieval (full lifecycle)', () => {
  let ctx; // { jobId, settlementId, clientToken, photographerToken, adminToken, ... }

  beforeAll(async () => {
    // Full lifecycle: register → verify → job → assign → agree → work → confirm → lock → settle
    ctx = await createFullJobLifecycle();

    // Approve the settlement so exports work
    await request('PATCH', `/api/settlements/${ctx.settlementId}/approve`, {
      varianceReason: 'Test approval',
    }, ctx.clientToken);

    // Grant consent for reports
    await request('POST', '/api/consent/data-category', { category: 'account_identity' }, ctx.clientToken);
  }, 60000);

  test('GET /api/settlements/:id returns settlement with line items', async () => {
    const res = await request('GET', `/api/settlements/${ctx.settlementId}`, null, ctx.clientToken);
    expect(res.status).toBe(200);
    expect(res.data.settlement).toBeDefined();
    expect(res.data.lineItems).toBeDefined();
    expect(res.data.lineItems.length).toBeGreaterThanOrEqual(1);
  });

  test('GET /api/settlements/:id/export/pdf returns PDF buffer', async () => {
    const res = await request('GET', `/api/settlements/${ctx.settlementId}/export/pdf`, null, ctx.clientToken);
    expect(res.status).toBe(200);
  });

  test('GET /api/settlements/:id/export/csv returns CSV data', async () => {
    const res = await request('GET', `/api/settlements/${ctx.settlementId}/export/csv`, null, ctx.clientToken);
    expect(res.status).toBe(200);
  });

  test('Non-participant cannot export settlement PDF → 403', async () => {
    const outsider = await request('POST', '/api/auth/register', {
      username: `sexpOut_${Date.now()}`, email: `sexpO${Date.now()}@t.com`, password: 'OutPass123!',
    });
    const res = await request('GET', `/api/settlements/${ctx.settlementId}/export/pdf`, null, outsider.data.token);
    expect(res.status).toBe(403);
  });

  test('POST /api/reports creates a report via API', async () => {
    // F-003: evidence attachment required on report submission
    const res = await submitReportWithEvidence(ctx.clientToken, {
      targetUserId: ctx.photographerId,
      category: 'other',
      description: 'Settlement lifecycle test report',
    });
    expect(res.status).toBe(201);
    expect(res.data._id).toBeDefined();
  });

  test('GET /api/reports/my returns user reports', async () => {
    const res = await request('GET', '/api/reports/my', null, ctx.clientToken);
    expect(res.status).toBe(200);
    const items = res.data.items || res.data || [];
    expect(items.length).toBeGreaterThanOrEqual(1);
  });

  test('Settlement amounts reflect real work entry calculations', async () => {
    const res = await request('GET', `/api/settlements/${ctx.settlementId}`, null, ctx.clientToken);
    expect(res.status).toBe(200);
    // 120 min at 6000 cents/hr = 12000 cents
    expect(res.data.settlement.subtotalCents).toBe(12000);
    expect(res.data.settlement.finalAmountCents).toBe(12000);
  });
});
