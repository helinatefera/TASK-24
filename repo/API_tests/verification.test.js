const { request, createAdminUser, createVerifiedPhotographer } = require('./helpers');
const http = require('http');
const crypto = require('crypto');
const BASE = process.env.API_BASE || 'http://server:3001';

function submitVerification(token) {
  const ts = Date.now();
  const boundary = '----VerBound' + ts;
  const pdfHeader = Buffer.from('%PDF-1.4\n');
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="documents"; filename="id.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfHeader, Buffer.alloc(100, 0x20),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="realName"\r\n\r\nTest Photographer\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="qualificationType"\r\n\r\ngeneral\r\n`),
    Buffer.from(`--${boundary}--`),
  ]);
  return new Promise((resolve, reject) => {
    const url = new URL('/api/verification/submit', BASE);
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': body.length,
        'Authorization': `Bearer ${token}`,
        'X-Nonce': crypto.randomUUID(),
        'X-Timestamp': Date.now().toString(),
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

describe('Verification Status Masking & Admin Review Flow', () => {
  let photographerToken, photographerId;
  let adminToken;
  let verificationId;

  beforeAll(async () => {
    const ts = Date.now();
    const photog = await request('POST', '/api/auth/register', {
      username: `vrPhot_${ts}`, email: `vr${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    photographerToken = photog.data.token;
    photographerId = photog.data.user._id;

    const admin = await createAdminUser();
    adminToken = admin.token;

    // Grant consents required for verification
    await request('POST', '/api/consent/data-category', { category: 'government_id' }, photographerToken);
    await request('POST', '/api/consent/data-category', { category: 'qualification_documents' }, photographerToken);

    // Submit verification via real API (multipart upload)
    const submitRes = await submitVerification(photographerToken);
    expect(submitRes.status).toBe(201);
    verificationId = submitRes.data._id;
  }, 30000);

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
    // Submit a new verification via real API
    const ts = Date.now();
    const photog2 = await request('POST', '/api/auth/register', {
      username: `vrP2_${ts}`, email: `vrp2${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    await request('POST', '/api/consent/data-category', { category: 'government_id' }, photog2.data.token);
    await request('POST', '/api/consent/data-category', { category: 'qualification_documents' }, photog2.data.token);
    const sub = await submitVerification(photog2.data.token);
    expect(sub.status).toBe(201);

    const res = await request('PATCH', `/api/verification/${sub.data._id}/review`, {
      status: 'verified',
      reviewNotes: 'All docs verified',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('verified');
  });

  test('Admin reject with {decision: "rejected", rejectionReason} succeeds', async () => {
    // Submit a new verification via real API
    const ts = Date.now();
    const photog3 = await request('POST', '/api/auth/register', {
      username: `vrP3_${ts}`, email: `vrp3${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    await request('POST', '/api/consent/data-category', { category: 'government_id' }, photog3.data.token);
    await request('POST', '/api/consent/data-category', { category: 'qualification_documents' }, photog3.data.token);
    const sub = await submitVerification(photog3.data.token);
    expect(sub.status).toBe(201);

    const res = await request('PATCH', `/api/verification/${sub.data._id}/review`, {
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

  test('Admin needs_changes transition with reason succeeds', async () => {
    // Submit a fresh verification through real API
    const ts = Date.now();
    const photog = await request('POST', '/api/auth/register', {
      username: `vrNC_${ts}`, email: `vrnc${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    await request('POST', '/api/consent/data-category', { category: 'government_id' }, photog.data.token);
    await request('POST', '/api/consent/data-category', { category: 'qualification_documents' }, photog.data.token);
    const sub = await submitVerification(photog.data.token);
    expect(sub.status).toBe(201);

    const res = await request('PATCH', `/api/verification/${sub.data._id}/review`, {
      status: 'needs_changes',
      reviewNotes: 'Please provide a clearer scan of your ID',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('needs_changes');
    expect(res.data.reviewReason).toContain('clearer');
  });

  test('Admin can re-review a needs_changes verification', async () => {
    // Seed: fresh submission → needs_changes → approve
    const ts = Date.now();
    const photog = await request('POST', '/api/auth/register', {
      username: `vrNC2_${ts}`, email: `vrnc2${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    await request('POST', '/api/consent/data-category', { category: 'government_id' }, photog.data.token);
    await request('POST', '/api/consent/data-category', { category: 'qualification_documents' }, photog.data.token);
    const sub = await submitVerification(photog.data.token);
    expect(sub.status).toBe(201);

    // First transition to needs_changes
    await request('PATCH', `/api/verification/${sub.data._id}/review`, {
      status: 'needs_changes', reviewNotes: 'More info needed',
    }, adminToken);

    // Then approve — needs_changes should accept a follow-up review
    const approveRes = await request('PATCH', `/api/verification/${sub.data._id}/review`, {
      decision: 'approved', reviewNotes: 'All good now',
    }, adminToken);
    expect(approveRes.status).toBe(200);
    expect(approveRes.data.status).toBe('verified');
  });
});
