const { request, createAdminUser } = require('./helpers');

describe('Work Entry Creation & Increment Validation', () => {
  let photographerToken, photographerId;
  let clientToken, clientId;
  let adminToken;
  let jobId;

  beforeAll(async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const ts = Date.now();

    const photog = await request('POST', '/api/auth/register', {
      username: `wePhot_${ts}`, email: `wep${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    photographerToken = photog.data.token;
    photographerId = photog.data.user._id;

    const client = await request('POST', '/api/auth/register', {
      username: `weCli_${ts}`, email: `wec${ts}@t.com`, password: 'CliPass123!',
    });
    clientToken = client.data.token;
    clientId = client.data.user._id;

    const admin = await createAdminUser();
    adminToken = admin.token;

    const job = await request('POST', '/api/jobs', {
      title: 'WE Test Job', description: 'Work entry test',
      jobType: 'event', rateType: 'hourly', agreedRateCents: 6000, estimatedTotalCents: 24000,
    }, clientToken);
    jobId = job.data._id;

    // Seed verification record so photographer can be assigned
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    try {
      await conn.collection('verifications').insertOne({
        photographerId: new mongoose.Types.ObjectId(photographerId),
        realName: 'Test Photographer', qualificationType: 'general',
        idDocumentPath: '/test', qualificationDocPaths: [],
        status: 'verified', submittedAt: new Date(), fileChecksums: [],
        createdAt: new Date(), updatedAt: new Date(),
      });
    } finally { await conn.close(); }

    // Post the job so it can be assigned
    await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, clientToken);
    await request('PATCH', `/api/jobs/${jobId}/assign`, { photographerId }, adminToken);

    const conn2 = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    try {
      await conn2.collection('jobs').updateOne(
        { _id: new mongoose.Types.ObjectId(jobId) },
        { $set: { status: 'in_progress' } }
      );
    } finally { await conn2.close(); }
  });

  // --- Time entries ---

  test('Valid time entry with durationMinutes (15-min aligned) → 201', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time',
      durationMinutes: 60,
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.durationMinutes).toBe(60);
    expect(res.data.subtotalCents).toBeDefined();
  });

  test('Time entry with startTime/endTime as HH:MM strings accepted', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time',
      durationMinutes: 30,
      startTime: '09:00',
      endTime: '09:30',
      date: '2026-04-10',
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.startTime).toBe('09:00');
    expect(res.data.endTime).toBe('09:30');
    expect(res.data.durationMinutes).toBe(30);
  });

  test('Time entry with date field is persisted', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time',
      durationMinutes: 15,
      date: '2026-04-10',
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.date).toBeDefined();
  });

  test('Non-15-min increment → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time',
      durationMinutes: 7,
    }, photographerToken);
    expect(res.status).toBe(400);
    expect(res.data.msg).toContain('15-minute');
  });

  test('Time entry missing durationMinutes → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time',
    }, photographerToken);
    expect(res.status).toBe(400);
  });

  // --- Piece rate entries ---

  test('Valid piece_rate entry → 201', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'piece_rate',
      quantity: 10,
      description: 'Event photos',
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.quantity).toBe(10);
  });

  test('Piece_rate without quantity → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'piece_rate',
      description: 'Missing qty',
    }, photographerToken);
    expect(res.status).toBe(400);
  });

  // --- Auth ---

  test('Non-photographer cannot create work entry → 403', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 30,
    }, clientToken);
    expect(res.status).toBe(403);
  });

  test('Invalid entryType → 400', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'overtime',
      durationMinutes: 30,
    }, photographerToken);
    expect(res.status).toBe(400);
  });

  // --- Field name contract ---

  test('durationMinutes is the canonical field (not hours)', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time',
      durationMinutes: 45,
    }, photographerToken);
    expect(res.status).toBe(201);
    expect(res.data.durationMinutes).toBe(45);
    expect(res.data.hours).toBeUndefined();
  });
});

describe('Work Entry Confirm & 48-Hour Locking', () => {
  let photographerToken, photographerId;
  let clientToken, clientId;
  let adminToken;
  let jobId, entryId;

  beforeAll(async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const ts = Date.now();

    const photog = await request('POST', '/api/auth/register', {
      username: `lcPhot_${ts}`, email: `lcp${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    photographerToken = photog.data.token;
    photographerId = photog.data.user._id;

    const client = await request('POST', '/api/auth/register', {
      username: `lcCli_${ts}`, email: `lcc${ts}@t.com`, password: 'CliPass123!',
    });
    clientToken = client.data.token;
    clientId = client.data.user._id;

    const admin = await createAdminUser();
    adminToken = admin.token;

    const job = await request('POST', '/api/jobs', {
      title: 'Lock Test Job', description: 'Locking test',
      jobType: 'event', rateType: 'hourly', agreedRateCents: 6000, estimatedTotalCents: 24000,
    }, clientToken);
    jobId = job.data._id;

    // Seed verification record so photographer can be assigned
    const connV = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    try {
      await connV.collection('verifications').insertOne({
        photographerId: new mongoose.Types.ObjectId(photographerId),
        realName: 'Test Photographer', qualificationType: 'general',
        idDocumentPath: '/test', qualificationDocPaths: [],
        status: 'verified', submittedAt: new Date(), fileChecksums: [],
        createdAt: new Date(), updatedAt: new Date(),
      });
    } finally { await connV.close(); }

    // Post the job so it can be assigned
    await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, clientToken);
    await request('PATCH', `/api/jobs/${jobId}/assign`, { photographerId }, adminToken);

    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    try {
      await conn.collection('jobs').updateOne(
        { _id: new mongoose.Types.ObjectId(jobId) },
        { $set: { status: 'in_progress' } }
      );
    } finally { await conn.close(); }

    // Create a work entry for confirmation tests
    const weRes = await request('POST', `/api/jobs/${jobId}/work-entries`, {
      entryType: 'time', durationMinutes: 60,
    }, photographerToken);
    entryId = weRes.data._id;
  });

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
    const ts = Date.now();
    const outsider = await request('POST', '/api/auth/register', {
      username: `lcOut_${ts}`, email: `lco${ts}@t.com`, password: 'OutPass123!',
    });
    const res = await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, outsider.data.token);
    expect(res.status).toBe(403);
  });

  test('Already-locked entry rejects confirm → 400', async () => {
    // Seed a locked entry directly
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let lockedId;
    try {
      const result = await conn.collection('workentries').insertOne({
        jobId: new mongoose.Types.ObjectId(jobId),
        photographerId: new mongoose.Types.ObjectId(photographerId),
        entryType: 'time', durationMinutes: 30, subtotalCents: 3000,
        isLocked: true, lockedAt: new Date(),
        clientConfirmedAt: new Date(), photographerConfirmedAt: new Date(),
        createdAt: new Date(), updatedAt: new Date(),
      });
      lockedId = result.insertedId.toString();
    } finally { await conn.close(); }

    const res = await request('PATCH', `/api/work-entries/${lockedId}/confirm`, {}, photographerToken);
    expect(res.status).toBe(400);
    expect(res.data.msg).toContain('locked');
  });
});
