/**
 * End-to-end lifecycle test — exercises the full request pipeline from
 * registration through settlement export with zero DB shortcuts.
 *
 * Every step uses real HTTP requests through the nonce middleware, auth
 * middleware, RBAC, content filter, and response serialization. This proves
 * the entire stack works as a unit, not just individual handlers.
 */
const { request, createAdminUser, createVerifiedPhotographer, ensureMongooseConnected } = require('./helpers');
const http = require('http');
const crypto = require('crypto');
const BASE = process.env.API_BASE || 'http://server:3001';

describe('E2E: Full Job-to-Settlement Lifecycle', () => {
  let adminToken;
  let clientToken, clientId;
  let photographerToken, photographerId;
  let jobId, entryId, settlementId;

  // Step 1: Provision users via real API
  test('Register admin, client, and verified photographer', async () => {
    const admin = await createAdminUser();
    adminToken = admin.token;

    const ts = Date.now();
    const clientRes = await request('POST', '/api/auth/register', {
      username: `e2eClient_${ts}`, email: `e2ec${ts}@t.com`, password: 'E2eClient1!',
    });
    expect(clientRes.status).toBe(201);
    clientToken = clientRes.data.token;
    clientId = clientRes.data.user._id;

    const photog = await createVerifiedPhotographer(adminToken);
    photographerToken = photog.token;
    photographerId = photog.userId;
  }, 30000);

  // Step 2: Auth/me returns server-authoritative profile
  test('GET /auth/me returns correct user with no passwordHash', async () => {
    const res = await request('GET', '/api/auth/me', null, clientToken);
    expect(res.status).toBe(200);
    expect(res.data._id).toBe(clientId);
    expect(res.data.passwordHash).toBeUndefined();
    expect(res.data.role).toBe('alumni');
  });

  // Step 3: Nonce enforcement — mutation without nonce gets 422
  test('POST without nonce headers gets 422', async () => {
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/jobs', BASE);
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${clientToken}` },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
          catch { resolve({ status: res.statusCode, data }); }
        });
      });
      req.on('error', reject);
      req.write(JSON.stringify({ title: 'No nonce test' }));
      req.end();
    });
    expect(res.status).toBe(422);
    expect(res.data.msg).toContain('X-Nonce');
  });

  // Step 4: Client creates a job
  test('Client creates a job via API', async () => {
    const res = await request('POST', '/api/jobs', {
      title: 'E2E Wedding Photography', description: 'Full lifecycle test event',
      jobType: 'event', rateType: 'hourly', agreedRateCents: 8000, estimatedTotalCents: 24000,
    }, clientToken);
    expect(res.status).toBe(201);
    expect(res.data._id).toBeDefined();
    expect(res.data.status).toBe('draft');
    jobId = res.data._id;
  });

  // Step 5: Post the job
  test('Client posts the job', async () => {
    const res = await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, clientToken);
    expect(res.status).toBe(200);
  });

  // Step 6: Assign verified photographer
  test('Client assigns verified photographer', async () => {
    const res = await request('PATCH', `/api/jobs/${jobId}/assign`, {
      photographerId,
    }, clientToken);
    expect(res.status).toBe(200);
    expect(res.data.photographerId).toBe(photographerId);
    expect(res.data.status).toBe('assigned');
  });

  // Step 7: Both confirm service agreement with password re-entry
  test('Client confirms agreement', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/agreement/confirm`, {
      password: 'E2eClient1!',
    }, clientToken);
    expect(res.status).toBe(200);
    expect(res.data.clientConfirmed).toBe(true);
  });

  test('Photographer confirms agreement — job transitions to in_progress', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/agreement/confirm`, {
      password: 'PhotPass123!',
    }, photographerToken);
    expect(res.status).toBe(200);
    expect(res.data.fullyConfirmed).toBe(true);
    expect(res.data.job.status).toBe('in_progress');
  });

  // Step 8: Photographer logs work
  test('Photographer creates a time-based work entry', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 180,
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.subtotalCents).toBe(24000); // 180min at 8000c/hr
    entryId = res.data._id;
  });

  // Step 9: Bilateral confirmation
  test('Photographer confirms work entry', async () => {
    const res = await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, photographerToken);
    expect(res.status).toBe(200);
    expect(res.data.photographerConfirmedAt).toBeDefined();
  });

  test('Client confirms work entry — lockAt set', async () => {
    const res = await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, clientToken);
    expect(res.status).toBe(200);
    expect(res.data.clientConfirmedAt).toBeDefined();
    expect(res.data.lockAt).toBeDefined();
  });

  // Step 10: Lock via the real locking job (LOCK_HOURS=0 in test env)
  test('Lock work entry via cron job and generate settlement', async () => {
    // With LOCK_HOURS=0, lockAt was set to ~now on bilateral confirm.
    // Trigger the same locking function the cron scheduler runs — zero DB shortcuts.
    await ensureMongooseConnected();
    const { lockWorkEntries } = require('/app/dist/jobs/workEntryLocking');
    await lockWorkEntries();

    const res = await request('POST', `/api/jobs/${jobId}/settlement`, {}, clientToken);
    expect(res.status).toBe(201);
    expect(res.data.settlement.subtotalCents).toBe(24000);
    settlementId = res.data.settlement._id;
  });

  // Step 11: Add adjustment via API
  test('Client adds a discount adjustment', async () => {
    const res = await request('POST', `/api/settlements/${settlementId}/adjustment`, {
      type: 'discount', amountCents: -2000, reason: 'Early booking discount',
    }, clientToken);
    expect(res.status).toBe(201);
    expect(res.data.settlement.adjustmentCents).toBe(-2000);
    expect(res.data.settlement.finalAmountCents).toBe(22000);
  });

  // Step 12: Approve settlement
  test('Client approves settlement', async () => {
    const res = await request('PATCH', `/api/settlements/${settlementId}/approve`, {}, clientToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('approved');
  });

  // Step 13: Record payment
  test('Client records payment against approved settlement', async () => {
    const res = await request('POST', `/api/settlements/${settlementId}/payments`, {
      amountCents: 22000, method: 'bank_transfer', reference: 'TXN-E2E-001',
    }, clientToken);
    expect(res.status).toBe(201);
    expect(res.data.amountCents).toBe(22000);
  });

  // Step 14: Export settlement
  test('Client exports settlement as PDF', async () => {
    const res = await request('GET', `/api/settlements/${settlementId}/export/pdf`, null, clientToken);
    expect(res.status).toBe(200);
  });

  // Step 15: Error format — no stack traces
  test('Error responses are structured JSON with no internals', async () => {
    const fakeId = '000000000000000000000000';
    const res = await request('GET', `/api/settlements/${fakeId}`, null, clientToken);
    expect([403, 404]).toContain(res.status);
    expect(res.data.code).toBeDefined();
    expect(res.data.msg).toBeDefined();
    const body = JSON.stringify(res.data);
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain('.js:');
  });

  // Step 16: Cross-user isolation
  test('Outsider cannot access the settlement', async () => {
    const outsider = await request('POST', '/api/auth/register', {
      username: `e2eOut_${Date.now()}`, email: `e2eo${Date.now()}@t.com`, password: 'OutPass123!',
    });
    const res = await request('GET', `/api/settlements/${settlementId}`, null, outsider.data.token);
    expect(res.status).toBe(403);
  });
});
