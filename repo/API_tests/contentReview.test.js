const { request, createAdminUser } = require('./helpers');

describe('Content Review Decision Flow', () => {
  let adminToken;
  let userToken, userId;
  let reviewId;

  beforeAll(async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const ts = Date.now();

    const admin = await createAdminUser();
    adminToken = admin.token;

    const user = await request('POST', '/api/auth/register', {
      username: `crUser_${ts}`, email: `cr${ts}@t.com`, password: 'CrPass123!',
    });
    userToken = user.data.token;
    userId = user.data.user._id;

    // Seed a pending content review directly
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    try {
      const result = await conn.collection('contentreviews').insertOne({
        contentType: 'job_message',
        contentId: new mongoose.Types.ObjectId(),
        submittedBy: new mongoose.Types.ObjectId(userId),
        flaggedWords: ['test'],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      reviewId = result.insertedId.toString();
    } finally { await conn.close(); }
  });

  test('Admin can list pending reviews', async () => {
    const res = await request('GET', '/api/admin/content-reviews', null, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();
  });

  test('Non-admin cannot list reviews → 403', async () => {
    const res = await request('GET', '/api/admin/content-reviews', null, userToken);
    expect(res.status).toBe(403);
  });

  test('Admin can approve review with {status, reviewNotes}', async () => {
    const res = await request('PATCH', `/api/admin/content-reviews/${reviewId}`, {
      status: 'approved',
      reviewNotes: 'Content is fine',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('approved');
  });

  test('Admin can reject review with {decision, reason} (frontend shape)', async () => {
    // Re-seed a new pending review
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let newId;
    try {
      const result = await conn.collection('contentreviews').insertOne({
        contentType: 'portfolio',
        contentId: new mongoose.Types.ObjectId(),
        submittedBy: new mongoose.Types.ObjectId(userId),
        flaggedWords: [],
        status: 'pending',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      newId = result.insertedId.toString();
    } finally { await conn.close(); }

    const res = await request('PATCH', `/api/admin/content-reviews/${newId}`, {
      decision: 'rejected',
      reason: 'Inappropriate content',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('rejected');
  });

  test('PATCH without status or decision → 400', async () => {
    const res = await request('PATCH', `/api/admin/content-reviews/${reviewId}`, {
      reviewNotes: 'No decision provided',
    }, adminToken);
    expect(res.status).toBe(400);
  });

  test('Non-admin cannot PATCH review → 403', async () => {
    const res = await request('PATCH', `/api/admin/content-reviews/${reviewId}`, {
      status: 'approved',
    }, userToken);
    expect(res.status).toBe(403);
  });
});
