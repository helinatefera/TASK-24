const { request, createAdminUser } = require('./helpers');

describe('Verification Status Masking & Admin Review Flow', () => {
  let photographerToken, photographerId;
  let adminToken;
  let verificationId;

  beforeAll(async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const ts = Date.now();
    const photog = await request('POST', '/api/auth/register', {
      username: `vrPhot_${ts}`, email: `vr${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    photographerToken = photog.data.token;
    photographerId = photog.data.user._id;

    const admin = await createAdminUser();
    adminToken = admin.token;

    await request('POST', '/api/consent/data-category', { category: 'government_id' }, photographerToken);
    await request('POST', '/api/consent/data-category', { category: 'qualification_documents' }, photographerToken);

    // Seed a verification record
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    try {
      const result = await conn.collection('verifications').insertOne({
        photographerId: new mongoose.Types.ObjectId(photographerId),
        realName: 'encrypted_test_name',
        qualificationType: 'general',
        idDocumentPath: 'encrypted_test_path',
        qualificationDocPaths: ['encrypted_qual_path'],
        status: 'submitted',
        submittedAt: new Date(),
        fileChecksums: ['abc123'],
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      verificationId = result.insertedId.toString();
    } finally { await conn.close(); }
  });

  // --- Masking ---

  test('Non-admin sees [REDACTED] for sensitive verification fields', async () => {
    const res = await request('GET', '/api/verification/status', null, photographerToken);
    expect(res.status).toBe(200);
    expect(res.data.idDocumentPath).toBe('[REDACTED]');
    expect(Array.isArray(res.data.qualificationDocPaths)).toBe(true);
    for (const p of res.data.qualificationDocPaths) {
      expect(p).toBe('[REDACTED]');
    }
  });

  test('Admin sees decrypted fields on verification requests', async () => {
    const res = await request('GET', '/api/verification/requests', null, adminToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    if (res.data.length > 0) {
      expect(res.data[0].idDocumentPath).not.toBe('[REDACTED]');
    }
  });

  test('Non-admin cannot access admin verification requests → 403', async () => {
    const res = await request('GET', '/api/verification/requests', null, photographerToken);
    expect(res.status).toBe(403);
  });

  test('Unauthenticated → 401', async () => {
    const res = await request('GET', '/api/verification/status');
    expect(res.status).toBe(401);
  });

  // --- Admin review: frontend sends {decision, rejectionReason}, backend normalizes ---

  test('Admin approve with {decision: "approved"} succeeds (normalized to verified)', async () => {
    const res = await request('PATCH', `/api/verification/${verificationId}/review`, {
      decision: 'approved',
      reviewNotes: 'Identity and qualifications verified',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('verified');
  });

  test('Admin approve with {status: "verified"} also works', async () => {
    // Re-seed as submitted
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let newId;
    try {
      const result = await conn.collection('verifications').insertOne({
        photographerId: new mongoose.Types.ObjectId(photographerId),
        realName: 'enc_name2', qualificationType: 'general',
        idDocumentPath: 'enc_path2', qualificationDocPaths: ['enc_qp2'],
        status: 'submitted', submittedAt: new Date(), fileChecksums: ['def456'],
        createdAt: new Date(), updatedAt: new Date(),
      });
      newId = result.insertedId.toString();
    } finally { await conn.close(); }

    const res = await request('PATCH', `/api/verification/${newId}/review`, {
      status: 'verified',
      reviewNotes: 'All docs verified',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('verified');
  });

  test('Admin reject with {decision: "rejected", rejectionReason} succeeds', async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let newId;
    try {
      const result = await conn.collection('verifications').insertOne({
        photographerId: new mongoose.Types.ObjectId(photographerId),
        realName: 'enc_name3', qualificationType: 'general',
        idDocumentPath: 'enc_path3', qualificationDocPaths: [],
        status: 'submitted', submittedAt: new Date(), fileChecksums: [],
        createdAt: new Date(), updatedAt: new Date(),
      });
      newId = result.insertedId.toString();
    } finally { await conn.close(); }

    const res = await request('PATCH', `/api/verification/${newId}/review`, {
      decision: 'rejected',
      rejectionReason: 'Documents unclear',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('rejected');
    expect(res.data.reviewReason).toBe('Documents unclear');
  });

  test('Non-admin cannot review → 403', async () => {
    const res = await request('PATCH', `/api/verification/${verificationId}/review`, {
      decision: 'approved',
    }, photographerToken);
    expect(res.status).toBe(403);
  });

  test('Review without decision or status → 400', async () => {
    const res = await request('PATCH', `/api/verification/${verificationId}/review`, {
      reviewNotes: 'No decision',
    }, adminToken);
    expect(res.status).toBe(400);
  });
});
