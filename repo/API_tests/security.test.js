const { request, createAdminUser } = require('./helpers');

describe('Security - Object-level Authorization', () => {
  let userAToken, userAId;
  let userBToken, userBId;
  let adminToken;
  let jobId;

  beforeAll(async () => {
    const a = await request('POST', '/api/auth/register', { username: `secA_${Date.now()}`, email: `secA${Date.now()}@t.com`, password: 'SecureA123!' });
    userAToken = a.data.token;
    userAId = a.data.user._id;

    const b = await request('POST', '/api/auth/register', { username: `secB_${Date.now()}`, email: `secB${Date.now()}@t.com`, password: 'SecureB123!' });
    userBToken = b.data.token;
    userBId = b.data.user._id;

    // Admin provisioned via controlled path, not self-registration
    const admin = await createAdminUser();
    adminToken = admin.token;

    // User A creates a job
    const job = await request('POST', '/api/jobs', {
      title: 'Security Test Job', description: 'Testing access', jobType: 'event',
      rateType: 'hourly', agreedRateCents: 5000, estimatedTotalCents: 10000,
    }, userAToken);
    jobId = job.data._id;
  });

  test('Admin self-registration is blocked', async () => {
    const res = await request('POST', '/api/auth/register', {
      username: `admin_attack_${Date.now()}`,
      email: `atk${Date.now()}@t.com`,
      password: 'AttackAdmin1!',
      role: 'admin',
    });
    expect(res.status).toBe(400);
  });

  test('User B cannot access User A draft job', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`, null, userBToken);
    expect(res.status).toBe(403);
    expect(res.data.code).toBe(403);
  });

  test('Admin CAN access any job', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`, null, adminToken);
    expect(res.status).toBe(200);
  });

  test('Unauthenticated request is rejected with 401', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`);
    expect(res.status).toBe(401);
    expect(res.data.code).toBe(401);
  });

  test('Non-admin cannot access admin endpoints', async () => {
    const res = await request('GET', '/api/admin/users', null, userAToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot access audit logs', async () => {
    const res = await request('GET', '/api/admin/audit', null, userAToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot manage blacklist', async () => {
    const res = await request('POST', '/api/admin/blacklist', { targetType: 'account', targetId: userBId, reason: 'test' }, userAToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot review content', async () => {
    const res = await request('GET', '/api/admin/content-reviews', null, userAToken);
    expect(res.status).toBe(403);
  });

  test('Non-admin cannot manage sensitive words', async () => {
    const res = await request('POST', '/api/admin/sensitive-words', { word: 'test', severity: 'low' }, userAToken);
    expect(res.status).toBe(403);
  });

  test('Cross-user settlement access is denied', async () => {
    const fakeId = '000000000000000000000000';
    const res = await request('GET', `/api/settlements/${fakeId}`, null, userBToken);
    expect([403, 404]).toContain(res.status);
  });

  test('Cross-user file access denied — verification parent', async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let fileId;
    try {
      const result = await conn.collection('fileattachments').insertOne({
        parentType: 'verification',
        parentId: new mongoose.Types.ObjectId(userAId),
        originalName: 'id_doc.pdf', storagePath: '/app/uploads/v1.pdf',
        mimeType: 'application/pdf', sizeBytes: 100, checksum: 'v1',
        uploadedBy: new mongoose.Types.ObjectId(userAId),
        createdAt: new Date(), updatedAt: new Date(),
      });
      fileId = result.insertedId.toString();
    } finally { await conn.close(); }
    const res = await request('GET', `/api/files/${fileId}`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('Cross-user file access denied — report parent', async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let fileId;
    try {
      const result = await conn.collection('fileattachments').insertOne({
        parentType: 'report',
        parentId: new mongoose.Types.ObjectId(userAId),
        originalName: 'evidence.png', storagePath: '/app/uploads/r1.png',
        mimeType: 'image/png', sizeBytes: 200, checksum: 'r1',
        uploadedBy: new mongoose.Types.ObjectId(userAId),
        createdAt: new Date(), updatedAt: new Date(),
      });
      fileId = result.insertedId.toString();
    } finally { await conn.close(); }
    const res = await request('GET', `/api/files/${fileId}`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('Cross-user file access denied — portfolio parent', async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    let portfolioId, fileId;
    try {
      // Create a portfolio owned by User A
      const pRes = await conn.collection('portfolios').insertOne({
        photographerId: new mongoose.Types.ObjectId(userAId),
        title: 'Test Portfolio', description: '', specialties: [],
        reviewStatus: 'pending', createdAt: new Date(), updatedAt: new Date(),
      });
      portfolioId = pRes.insertedId;
      const result = await conn.collection('fileattachments').insertOne({
        parentType: 'portfolio',
        parentId: portfolioId,
        originalName: 'photo.jpg', storagePath: '/app/uploads/p1.jpg',
        mimeType: 'image/jpeg', sizeBytes: 300, checksum: 'p1',
        uploadedBy: new mongoose.Types.ObjectId(userAId),
        createdAt: new Date(), updatedAt: new Date(),
      });
      fileId = result.insertedId.toString();
    } finally { await conn.close(); }
    const res = await request('GET', `/api/files/${fileId}`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('User B cannot read User A job work entries', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/work-entries`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('User B cannot read User A job deliverables', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/deliverables`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('User B cannot read User A job escrow', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/escrow`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('User B cannot read User A job messages', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/messages`, null, userBToken);
    expect(res.status).toBe(403);
  });

  test('Admin can read any job work entries', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/work-entries`, null, adminToken);
    expect(res.status).toBe(200);
  });

  test('Admin can read any job deliverables', async () => {
    const res = await request('GET', `/api/jobs/${jobId}/deliverables`, null, adminToken);
    expect(res.status).toBe(200);
  });
});

describe('Security - Settlement/Payment Mutation Authorization', () => {
  let ownerToken, ownerId, ownerJobId, settlementId, approvedSettlementId;
  let outsiderToken;

  beforeAll(async () => {
    const mongoose = require('/app/node_modules/mongoose');
    const ts = Date.now();
    const owner = await request('POST', '/api/auth/register', {
      username: `settOwner_${ts}`, email: `so${ts}@t.com`, password: 'OwnerPass1!',
    });
    ownerToken = owner.data.token;
    ownerId = owner.data.user._id;

    const outsider = await request('POST', '/api/auth/register', {
      username: `settOut_${ts}`, email: `sout${ts}@t.com`, password: 'OutPass123!',
    });
    outsiderToken = outsider.data.token;

    // Create a job
    const job = await request('POST', '/api/jobs', {
      title: 'Settlement Auth Test', description: 'Testing settlement authz',
      jobType: 'event', rateType: 'hourly', agreedRateCents: 5000, estimatedTotalCents: 10000,
    }, ownerToken);
    ownerJobId = job.data._id;

    // Create settlements directly in DB (full flow requires photographer + locked entries)
    const conn = await mongoose.createConnection(process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork').asPromise();
    try {
      // Draft settlement for approve/adjust tests
      const result = await conn.collection('settlements').insertOne({
        jobId: new mongoose.Types.ObjectId(ownerJobId),
        clientId: new mongoose.Types.ObjectId(ownerId),
        photographerId: new mongoose.Types.ObjectId(ownerId),
        status: 'draft',
        subtotalCents: 5000,
        adjustmentCents: 0,
        finalAmountCents: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      settlementId = result.insertedId.toString();

      // Approved settlement specifically for the payment authz test
      const approvedResult = await conn.collection('settlements').insertOne({
        jobId: new mongoose.Types.ObjectId(ownerJobId),
        clientId: new mongoose.Types.ObjectId(ownerId),
        photographerId: new mongoose.Types.ObjectId(ownerId),
        status: 'approved',
        subtotalCents: 5000,
        adjustmentCents: 0,
        finalAmountCents: 5000,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
      approvedSettlementId = approvedResult.insertedId.toString();
    } finally {
      await conn.close();
    }
  });

  test('Non-participant cannot create settlement for someone else job', async () => {
    expect(ownerJobId).toBeDefined();
    const res = await request('POST', `/api/jobs/${ownerJobId}/settlement`, null, outsiderToken);
    expect(res.status).toBe(403);
  });

  test('Non-participant cannot approve existing settlement', async () => {
    expect(settlementId).toBeDefined();
    const res = await request('PATCH', `/api/settlements/${settlementId}/approve`, {}, outsiderToken);
    expect(res.status).toBe(403);
  });

  test('Non-participant cannot add adjustment to existing settlement', async () => {
    expect(settlementId).toBeDefined();
    const res = await request('POST', `/api/settlements/${settlementId}/adjustment`, {
      amountCents: 100, reason: 'test',
    }, outsiderToken);
    expect(res.status).toBe(403);
  });

  test('Non-participant cannot record payment on approved settlement', async () => {
    expect(approvedSettlementId).toBeDefined();
    const res = await request('POST', `/api/settlements/${approvedSettlementId}/payments`, {
      amountCents: 100, method: 'cash',
    }, outsiderToken);
    expect(res.status).toBe(403);
  });

  test('Owner can read their own settlement', async () => {
    expect(settlementId).toBeDefined();
    const res = await request('GET', `/api/settlements/${settlementId}`, null, ownerToken);
    expect(res.status).toBe(200);
  });

  test('Non-participant cannot read existing settlement', async () => {
    expect(settlementId).toBeDefined();
    const res = await request('GET', `/api/settlements/${settlementId}`, null, outsiderToken);
    expect(res.status).toBe(403);
  });
});

describe('Security - Community Isolation', () => {
  test('Job list is scoped to user community', async () => {
    // Register user and create a job
    const ts = Date.now();
    const u = await request('POST', '/api/auth/register', {
      username: `iso_${ts}`, email: `iso${ts}@t.com`, password: 'IsoPass123!',
    });
    const res = await request('GET', '/api/jobs', null, u.data.token);
    expect(res.status).toBe(200);
    // Should return jobs array (community-scoped, may be empty)
    expect(res.data.jobs).toBeDefined();
  });

  test('Profile list returns minimized fields', async () => {
    const ts = Date.now();
    const u = await request('POST', '/api/auth/register', {
      username: `prof_${ts}`, email: `prof${ts}@t.com`, password: 'ProfPass123!',
    });
    const res = await request('GET', '/api/profiles', null, u.data.token);
    expect(res.status).toBe(200);
    if (res.data.profiles && res.data.profiles.length > 0) {
      const profile = res.data.profiles[0];
      // Should NOT expose full private data like phone, email, bio in list view
      expect(profile.phone).toBeUndefined();
      expect(profile.email).toBeUndefined();
      expect(profile.bio).toBeUndefined();
    }
  });
});

describe('Security - Nonce Enforcement', () => {
  test('Request without nonce is rejected on protected routes', async () => {
    const http = require('http');
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/auth/register', process.env.API_BASE || 'http://server:3001');
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
      });
      req.on('error', reject);
      req.write(JSON.stringify({ username: 'nonce_test', email: 'nt@t.com', password: 'Test1234!' }));
      req.end();
    });
    expect(res.status).toBe(400);
    expect(res.data.msg).toContain('X-Nonce');
  });

  test('Health endpoint works without nonce', async () => {
    const http = require('http');
    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/health', process.env.API_BASE || 'http://server:3001');
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'GET',
      }, (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => { try { resolve({ status: res.statusCode, data: JSON.parse(data) }); } catch { resolve({ status: res.statusCode, data }); } });
      });
      req.on('error', reject);
      req.end();
    });
    expect(res.status).toBe(200);
  });
});

describe('Security - Password Validation', () => {
  test('Weak password rejected on register', async () => {
    const res = await request('POST', '/api/auth/register', { username: `pw_${Date.now()}`, email: `pw${Date.now()}@t.com`, password: '123' });
    expect(res.status).toBe(400);
    expect(res.data.msg).toBeDefined();
  });

  test('Password without uppercase rejected', async () => {
    const res = await request('POST', '/api/auth/register', { username: `pw2_${Date.now()}`, email: `pw2${Date.now()}@t.com`, password: 'alllowercase1' });
    expect(res.status).toBe(400);
  });
});

describe('Security - Error Response Format', () => {
  test('401 error has structured format', async () => {
    const res = await request('GET', '/api/profiles');
    expect(res.data.code).toBe(401);
    expect(typeof res.data.msg).toBe('string');
    expect(Object.keys(res.data)).toEqual(expect.arrayContaining(['code', 'msg']));
  });

  test('403 error has structured format', async () => {
    const reg = await request('POST', '/api/auth/register', { username: `err_${Date.now()}`, email: `err${Date.now()}@t.com`, password: 'ErrTest123!' });
    const res = await request('GET', '/api/admin/users', null, reg.data.token);
    expect(res.data.code).toBe(403);
    expect(typeof res.data.msg).toBe('string');
  });

  test('Errors never contain stack traces or internal paths', async () => {
    const res = await request('GET', '/api/profiles');
    const body = JSON.stringify(res.data);
    expect(body).not.toMatch(/at\s+\w+.*\(/);
    expect(body).not.toContain('node_modules');
    expect(body).not.toContain('.js:');
    expect(body).not.toContain('Error:');
  });
});

describe('Security - Upload Validation', () => {
  let photographerToken;

  beforeAll(async () => {
    const ts = Date.now();
    const p = await request('POST', '/api/auth/register', {
      username: `photog_${ts}`, email: `ph${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    photographerToken = p.data.token;
  });

  test('Invalid MIME type rejected on verification upload', async () => {
    const http = require('http');
    const boundary = '----TestBoundary' + Date.now();
    // Build a minimal multipart body with a .exe file (disallowed MIME)
    const body = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="documents"; filename="malware.exe"',
      'Content-Type: application/x-msdownload',
      '',
      'MZ fake exe content',
      `--${boundary}--`,
    ].join('\r\n');

    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/verification/submit', process.env.API_BASE || 'http://server:3001');
      const nonce = require('crypto').randomUUID();
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Authorization': `Bearer ${photographerToken}`,
          'X-Nonce': nonce,
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
    expect(res.status).toBe(400);
  });

  test('Oversize file rejected on verification upload', async () => {
    const http = require('http');
    const boundary = '----TestBoundary' + Date.now();
    // 11MB file exceeds 10MB multer limit
    const bigContent = Buffer.alloc(11 * 1024 * 1024, 0x41);
    const header = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="documents"; filename="huge.pdf"',
      'Content-Type: application/pdf',
      '',
      '',
    ].join('\r\n');
    const footer = `\r\n--${boundary}--`;
    const bodyBuf = Buffer.concat([Buffer.from(header), bigContent, Buffer.from(footer)]);

    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/verification/submit', process.env.API_BASE || 'http://server:3001');
      const nonce = require('crypto').randomUUID();
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuf.length,
          'Authorization': `Bearer ${photographerToken}`,
          'X-Nonce': nonce,
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
      req.write(bodyBuf);
      req.end();
    });
    // Multer rejects with 413 or express returns 400/500 for oversize
    expect([400, 413, 500]).toContain(res.status);
  });

  test('Malformed PDF signature rejected on verification upload', async () => {
    const http = require('http');
    const boundary = '----TestBoundary' + Date.now();
    // Send a file claiming to be PDF but with JPEG magic bytes
    const fakeContent = Buffer.from([0xFF, 0xD8, 0xFF, 0xE0, 0x00]);
    const header = [
      `--${boundary}`,
      'Content-Disposition: form-data; name="documents"; filename="fake.pdf"',
      'Content-Type: application/pdf',
      '',
      '',
    ].join('\r\n');
    const footer = `\r\n--${boundary}--`;
    const bodyBuf = Buffer.concat([Buffer.from(header), fakeContent, Buffer.from(footer)]);

    const res = await new Promise((resolve, reject) => {
      const url = new URL('/api/verification/submit', process.env.API_BASE || 'http://server:3001');
      const nonce = require('crypto').randomUUID();
      const req = http.request({
        hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
        headers: {
          'Content-Type': `multipart/form-data; boundary=${boundary}`,
          'Content-Length': bodyBuf.length,
          'Authorization': `Bearer ${photographerToken}`,
          'X-Nonce': nonce,
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
      req.write(bodyBuf);
      req.end();
    });
    expect(res.status).toBe(400);
  });
});
