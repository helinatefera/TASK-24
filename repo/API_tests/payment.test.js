const { request, createFullJobLifecycle } = require('./helpers');

describe('H-04: Payment & Escrow Payload Validation', () => {
  let ownerToken, ownerId, jobId, approvedSettlementId;

  beforeAll(async () => {
    // Full lifecycle: register → verify → job → assign → agree → work → lock → settle
    const ctx = await createFullJobLifecycle();
    ownerToken = ctx.clientToken;
    ownerId = ctx.clientId;
    jobId = ctx.jobId;

    // Approve the settlement via API so payments can be recorded
    await request('PATCH', `/api/settlements/${ctx.settlementId}/approve`, {
      varianceReason: 'Approved for payment test',
    }, ctx.clientToken);
    approvedSettlementId = ctx.settlementId;
  }, 60000);

  // --- Payment amountCents validation ---

  test('Valid payment (integer amountCents) → 201', async () => {
    const res = await request('POST', `/api/settlements/${approvedSettlementId}/payments`, {
      amountCents: 1000, method: 'bank_transfer',
    }, ownerToken);
    expect(res.status).toBe(201);
    expect(res.data.amountCents).toBe(1000);
  });

  test('Non-integer amountCents → 400', async () => {
    const res = await request('POST', `/api/settlements/${approvedSettlementId}/payments`, {
      amountCents: 10.5, method: 'cash',
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  test('Negative amountCents → 400', async () => {
    const res = await request('POST', `/api/settlements/${approvedSettlementId}/payments`, {
      amountCents: -100, method: 'cash',
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  test('Missing amountCents → 400', async () => {
    const res = await request('POST', `/api/settlements/${approvedSettlementId}/payments`, {
      method: 'cash',
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  test('Missing method → 400', async () => {
    const res = await request('POST', `/api/settlements/${approvedSettlementId}/payments`, {
      amountCents: 1000,
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  test('Invalid method → 400', async () => {
    const res = await request('POST', `/api/settlements/${approvedSettlementId}/payments`, {
      amountCents: 1000, method: 'bitcoin',
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  // --- Escrow amountCents validation ---

  test('Valid escrow deposit → 201 with amountCents', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/escrow`, {
      amountCents: 5000, description: 'Initial deposit',
    }, ownerToken);
    expect(res.status).toBe(201);
    expect(res.data.amountCents).toBe(5000);
  });

  test('Non-integer escrow amountCents → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/escrow`, {
      amountCents: 50.5, description: 'Bad',
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  test('Negative escrow amountCents → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/escrow`, {
      amountCents: -100, description: 'Negative',
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  test('Missing escrow description → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/escrow`, {
      amountCents: 5000,
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  test('Invalid escrow entryType → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/escrow`, {
      amountCents: 5000, description: 'Bad type', entryType: 'steal',
    }, ownerToken);
    expect(res.status).toBe(400);
  });

  // --- Escrow GET structured response ---

  test('Escrow GET returns {entries, balanceCents}', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/escrow`, null, ownerToken);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('entries');
    expect(res.data).toHaveProperty('balanceCents');
    expect(Array.isArray(res.data.entries)).toBe(true);
    expect(res.data.entries.length).toBeGreaterThan(0);
    expect(typeof res.data.balanceCents).toBe('number');
    // Each entry uses amountCents
    for (const e of res.data.entries) {
      expect(Number.isInteger(e.amountCents)).toBe(true);
      expect(Number.isInteger(e.balanceCents)).toBe(true);
    }
  });

  test('Escrow GET by non-participant → 403', async () => {
    const ts = Date.now();
    const outsider = await request('POST', '/api/auth/register', {
      username: `h04Out_${ts}`, email: `h04x${ts}@t.com`, password: 'EscOut123!',
    });
    const res = await request('GET', `/api/jobs/${jobId}/escrow`, null, outsider.data.token);
    expect(res.status).toBe(403);
  });

  // --- Payment list uses amountCents ---

  test('Payment list entries all have integer amountCents', async () => {
    const res = await request('GET', `/api/settlements/${approvedSettlementId}/payments`, null, ownerToken);
    expect(res.status).toBe(200);
    for (const p of res.data) {
      expect(Number.isInteger(p.amountCents)).toBe(true);
    }
  });
});
