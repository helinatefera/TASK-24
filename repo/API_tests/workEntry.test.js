const { request, createAdminUser, createVerifiedPhotographer, ensureMongooseConnected } = require('./helpers');

describe('Work Entry Creation & Increment Validation', () => {
  let photographerToken, photographerId;
  let clientToken, clientId;
  let adminToken;
  let jobId;

  beforeAll(async () => {
    const ts = Date.now();

    const admin = await createAdminUser();
    adminToken = admin.token;

    const client = await request('POST', '/api/auth/register', {
      username: `weCli_${ts}`, email: `wec${ts}@t.com`, password: 'CliPass123!',
    });
    clientToken = client.data.token;
    clientId = client.data.user._id;

    // Verified photographer via real API flow (submit + admin approve)
    const photog = await createVerifiedPhotographer(adminToken);
    photographerToken = photog.token;
    photographerId = photog.userId;

    const job = await request('POST', '/api/jobs', {
      title: 'WE Test Job', description: 'Work entry test',
      jobType: 'event', rateType: 'hourly', agreedRateCents: 6000, estimatedTotalCents: 24000,
    }, clientToken);
    jobId = job.data._id;

    // Full lifecycle: post → assign → both confirm agreement → in_progress
    await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, clientToken);
    await request('PATCH', `/api/jobs/${jobId}/assign`, { photographerId }, clientToken);
    await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'CliPass123!' }, clientToken);
    await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'PhotPass123!' }, photographerToken);
  }, 60000);

  // --- Time entries ---

  test('Valid 60-minute entry → 201 with correct subtotal', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 60,
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.subtotalCents).toBe(6000); // 60min * 6000c/hr
    expect(res.data.entryType).toBe('time');
    expect(res.data.isLocked).toBe(false);
  });

  test('15-minute entry → 201 with correct subtotal', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 15,
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.subtotalCents).toBe(1500); // 15min * 6000c/hr
  });

  test('Non-aligned duration (17 min) → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 17,
    }, photographerToken);
    expect(res.status).toBe(400);
    expect(res.data.msg).toContain('increment');
  });

  test('Zero duration → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 0,
    }, photographerToken);
    expect(res.status).toBe(400);
  });

  test('Missing entryType → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      durationMinutes: 60,
    }, photographerToken);
    expect(res.status).toBe(400);
  });

  // --- Piece-rate entries ---

  test('Valid piece-rate entry → 201', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'piece_rate', quantity: 10, itemDescription: 'Headshots',
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.subtotalCents).toBe(60000); // 10 * 6000c
  });

  test('Zero quantity → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'piece_rate', quantity: 0, itemDescription: 'Bad',
    }, photographerToken);
    expect(res.status).toBe(400);
  });

  test('Non-participant cannot add entries → 403', async () => {
    const outsider = await request('POST', '/api/auth/register', {
      username: `weOut_${Date.now()}`, email: `weo${Date.now()}@t.com`, password: 'OutPass123!',
    });
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 60,
    }, outsider.data.token);
    expect(res.status).toBe(403);
  });

  test('Client cannot add entries (only photographer) → 403', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 60,
    }, clientToken);
    expect(res.status).toBe(403);
  });

  test('GET /api/jobs/:id/work-entries returns entries', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/work-entries`, null, clientToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThanOrEqual(3);
  });

  test('GET messages also works (covers message route)', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/messages`, null, clientToken);
    expect(res.status).toBe(200);
  });
});

describe('Work Entry Confirmation & Locking', () => {
  let photographerToken, photographerId;
  let clientToken, clientId;
  let adminToken;
  let jobId, entryId;

  beforeAll(async () => {
    const ts = Date.now();

    const admin = await createAdminUser();
    adminToken = admin.token;

    const client = await request('POST', '/api/auth/register', {
      username: `wcCli_${ts}`, email: `wcc${ts}@t.com`, password: 'WcCli1234!',
    });
    clientToken = client.data.token;
    clientId = client.data.user._id;

    // Verified photographer via real flow
    const photog = await createVerifiedPhotographer(adminToken);
    photographerToken = photog.token;
    photographerId = photog.userId;

    const job = await request('POST', '/api/jobs', {
      title: 'Lock Test Job', description: 'Locking test',
      jobType: 'event', rateType: 'hourly', agreedRateCents: 6000, estimatedTotalCents: 24000,
    }, clientToken);
    jobId = job.data._id;

    // Full lifecycle to in_progress via API
    await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, clientToken);
    await request('PATCH', `/api/jobs/${jobId}/assign`, { photographerId }, clientToken);
    await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'WcCli1234!' }, clientToken);
    await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'PhotPass123!' }, photographerToken);

    // Create a work entry for confirmation tests
    const weRes = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 60,
    }, photographerToken);
    entryId = weRes.data._id;
  }, 60000);

  test('Photographer can confirm their own entry', async () => {
    const res = await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, photographerToken);
    expect(res.status).toBe(200);
    expect(res.data.photographerConfirmedAt).toBeDefined();
  });

  test('Photographer cannot double-confirm', async () => {
    const res = await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, photographerToken);
    expect(res.status).toBe(400);
    expect(res.data.msg).toContain('already confirmed');
  });

  test('Client can confirm the entry (bilateral)', async () => {
    const res = await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, clientToken);
    expect(res.status).toBe(200);
    expect(res.data.clientConfirmedAt).toBeDefined();
    // Both confirmed → lockAt should be set (48h from now)
    expect(res.data.lockAt).toBeDefined();
  });

  test('Non-participant cannot confirm → 403', async () => {
    const outsider = await request('POST', '/api/auth/register', {
      username: `wcOut_${Date.now()}`, email: `wco${Date.now()}@t.com`, password: 'OutPass123!',
    });
    const res = await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, outsider.data.token);
    expect(res.status).toBe(403);
  });

  test('Locked entry cannot be confirmed → 400', async () => {
    // With LOCK_HOURS=0 in test env, entry locks immediately after bilateral confirm.
    // Trigger the lock job (same code the cron runs) — no DB shortcut.
    await ensureMongooseConnected();
    const { lockWorkEntries } = require('/app/dist/jobs/workEntryLocking');
    await lockWorkEntries();

    const res = await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, photographerToken);
    expect(res.status).toBe(400);
    expect(res.data.msg).toContain('locked');
  });

  test('PUT /api/work-entries/:id edits an unconfirmed entry', async () => {
    // Create a fresh entry (unconfirmed) to edit
    const createRes = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 30, notes: 'original',
    }, photographerToken);
    expect(createRes.status).toBe(201);
    const newId = createRes.data._id;

    const res = await request('PUT', `/api/work-entries/${newId}`, {
      durationMinutes: 45, notes: 'edited',
    }, photographerToken);
    expect(res.status).toBe(200);
  });
});
