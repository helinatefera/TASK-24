const { request, createAdminUser, createVerifiedPhotographer } = require('./helpers');
const http = require('http');
const crypto = require('crypto');

function multipartUpload(url, token, fields, fileField) {
  const boundary = '----TestBound' + Date.now();
  const parts = [];
  for (const [name, value] of Object.entries(fields)) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
  }
  if (fileField) {
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${fileField.name}"; filename="${fileField.filename}"\r\nContent-Type: ${fileField.contentType}\r\n\r\n`));
    parts.push(fileField.buffer);
    parts.push(Buffer.from('\r\n'));
  }
  parts.push(Buffer.from(`--${boundary}--`));
  const body = Buffer.concat(parts);

  return new Promise((resolve, reject) => {
    const parsed = new URL(url, process.env.API_BASE || 'http://server:3001');
    const req = http.request({
      hostname: parsed.hostname, port: parsed.port, path: parsed.pathname, method: 'POST',
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

// Generate a real JPEG that the server can validate (magic bytes + processable by sharp)
let VALID_JPEG;
beforeAll(async () => {
  const sharp = require('/app/node_modules/sharp');
  VALID_JPEG = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } } }).jpeg().toBuffer();
});

describe('H-01: Deliverable Upload Auth & Validation', () => {
  let photographerToken, photographerId;
  let alumniToken;
  let adminToken;
  let jobId;

  beforeAll(async () => {
    const ts = Date.now();
    const photog = await request('POST', '/api/auth/register', {
      username: `h01Phot_${ts}`, email: `h01p${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    photographerToken = photog.data.token;
    photographerId = photog.data.user._id;

    const alumni = await request('POST', '/api/auth/register', {
      username: `h01Alum_${ts}`, email: `h01a${ts}@t.com`, password: 'AlumPass123!',
    });
    alumniToken = alumni.data.token;

    const admin = await createAdminUser();
    adminToken = admin.token;

    // Re-register photographer through verified flow instead of DB seeding
    const verifiedPhotog = await createVerifiedPhotographer(adminToken);
    photographerToken = verifiedPhotog.token;
    photographerId = verifiedPhotog.userId;

    const job = await request('POST', '/api/jobs', {
      title: 'H01 Test Job', description: 'Deliverable auth test',
      jobType: 'event', rateType: 'hourly', agreedRateCents: 5000, estimatedTotalCents: 10000,
    }, alumniToken);
    jobId = job.data._id;

    // Full lifecycle: post → assign via API (no DB seeding)
    await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, alumniToken);
    await request('PATCH', `/api/jobs/${jobId}/assign`, { photographerId }, alumniToken);
  }, 60000);

  test('Unauthorized (no token) upload → 401', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/deliverables`, {});
    expect(res.status).toBe(401);
  });

  test('Alumni (non-photographer role) upload → 403', async () => {
    const res = await multipartUpload(
      `/api/jobs/${jobId}/deliverables`, alumniToken,
      { copyrightNotice: 'Test' },
      { name: 'file', filename: 'test.jpg', contentType: 'image/jpeg', buffer: VALID_JPEG },
    );
    expect(res.status).toBe(403);
  });

  test('Upload without copyrightNotice → 400', async () => {
    const res = await multipartUpload(
      `/api/jobs/${jobId}/deliverables`, photographerToken,
      {},
      { name: 'file', filename: 'test.jpg', contentType: 'image/jpeg', buffer: VALID_JPEG },
    );
    expect(res.status).toBe(400);
  });

  test('Authorized photographer upload with valid data → 201', async () => {
    const res = await multipartUpload(
      `/api/jobs/${jobId}/deliverables`, photographerToken,
      { copyrightNotice: '(c) 2026 Test Photographer' },
      { name: 'file', filename: 'deliverable.jpg', contentType: 'image/jpeg', buffer: VALID_JPEG },
    );
    expect(res.status).toBe(201);
    expect(res.data._id).toBeDefined();
    expect(res.data.copyrightNotice).toBe('(c) 2026 Test Photographer');
  });

  test('Admin can upload deliverables', async () => {
    const res = await multipartUpload(
      `/api/jobs/${jobId}/deliverables`, adminToken,
      { copyrightNotice: 'Admin upload' },
      { name: 'file', filename: 'admin.jpg', contentType: 'image/jpeg', buffer: VALID_JPEG },
    );
    expect(res.status).toBe(201);
  });

  test('Non-participant cannot view deliverables → 403', async () => {
    const ts = Date.now();
    const outsider = await request('POST', '/api/auth/register', {
      username: `h01Out_${ts}`, email: `h01o${ts}@t.com`, password: 'OutPass123!',
    });
    const res = await request('GET', `/api/jobs/${jobId}/deliverables`, null, outsider.data.token);
    expect(res.status).toBe(403);
  });

  test('Assigned photographer can view deliverables → 200', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/deliverables`, null, photographerToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data)).toBe(true);
    expect(res.data.length).toBeGreaterThan(0);
  });
});
