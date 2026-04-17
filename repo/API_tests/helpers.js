const http = require('http');
const crypto = require('crypto');

const BASE = process.env.API_BASE || 'http://server:3001';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';

/**
 * Establish the DEFAULT mongoose connection for the jest process.
 * Required when tests call `require('/app/dist/jobs/...')` — those modules
 * use mongoose models that operate on the default connection.
 */
let _connectedPromise = null;
async function ensureMongooseConnected() {
  if (_connectedPromise) return _connectedPromise;
  const mongoose = require('/app/node_modules/mongoose');
  if (mongoose.connection.readyState === 1) {
    _connectedPromise = Promise.resolve();
    return _connectedPromise;
  }
  _connectedPromise = mongoose.connect(MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
    bufferCommands: false,
  }).then(() => undefined);
  return _connectedPromise;
}

function request(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE);
    const nonce = crypto.randomUUID();
    const timestamp = Date.now().toString();
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname,
      method,
      headers: {
        'Content-Type': 'application/json',
        'X-Nonce': nonce,
        'X-Timestamp': timestamp,
      },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        let parsed;
        try { parsed = JSON.parse(data); } catch { parsed = data; }
        // Extract session token from set-cookie header for auth flows
        const setCookie = res.headers['set-cookie'] || [];
        const sessionCookie = setCookie.find(c => c.startsWith('session='));
        const cookieToken = sessionCookie ? sessionCookie.split(';')[0].split('=')[1] : undefined;
        // Attach token to data for backward compatibility with tests that read data.token
        if (cookieToken && typeof parsed === 'object' && !parsed.token) {
          parsed.token = cookieToken;
        }
        resolve({ status: res.statusCode, data: parsed, cookieToken });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

/**
 * Register a regular user, then promote to admin via direct DB update.
 * Uses mongoose from the server's node_modules.
 * Returns { token, userId }.
 */
async function createAdminUser() {
  const mongoose = require('/app/node_modules/mongoose');
  const ts = Date.now();
  const username = `admin_${ts}`;
  const email = `adm${ts}@t.com`;

  // Register as a regular user first
  const res = await request('POST', '/api/auth/register', {
    username,
    email,
    password: 'AdminPass123!',
  });

  if (res.status !== 201) {
    throw new Error(`Failed to register admin seed user: ${JSON.stringify(res.data)}`);
  }

  const userId = res.data.user._id;

  // DB SHORTCUT 1/2: Promote to admin via direct DB write.
  // Rationale: Admin self-registration is blocked by design (registration endpoint
  // rejects role='admin'). This is the same path documented in README (mongosh).
  // All subsequent admin operations go through real API with the re-issued token.
  const conn = await mongoose.createConnection(MONGO_URI).asPromise();
  try {
    await conn.collection('users').updateOne(
      { _id: new mongoose.Types.ObjectId(userId) },
      { $set: { role: 'admin' } },
    );
  } finally {
    await conn.close();
  }

  // Re-login to get a token with the updated role
  const loginRes = await request('POST', '/api/auth/login', { username, password: 'AdminPass123!' });
  return { token: loginRes.data.token, userId };
}

/**
 * Register a photographer with required consents and verified status.
 * Exercises the real verification submit + admin review flow.
 * Returns { token, userId }.
 */
async function createVerifiedPhotographer(adminToken) {
  const ts = Date.now();
  const res = await request('POST', '/api/auth/register', {
    username: `photog_${ts}`, email: `ph${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
  });
  if (res.status !== 201) throw new Error(`Failed to register photographer: ${JSON.stringify(res.data)}`);
  const token = res.data.token;
  const userId = res.data.user._id;

  // Grant consents required for verification
  await request('POST', '/api/consent/data-category', { category: 'government_id' }, token);
  await request('POST', '/api/consent/data-category', { category: 'qualification_documents' }, token);

  // Submit verification via multipart upload (real API path)
  const boundary = '----Bound' + ts;
  const pdfHeader = Buffer.from('%PDF-1.4\n');
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="documents"; filename="id.pdf"\r\nContent-Type: application/pdf\r\n\r\n`),
    pdfHeader, Buffer.alloc(100, 0x20),
    Buffer.from(`\r\n--${boundary}\r\nContent-Disposition: form-data; name="realName"\r\n\r\nTest Photographer\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="qualificationType"\r\n\r\ngeneral\r\n`),
    Buffer.from(`--${boundary}--`),
  ]);

  const submitRes = await new Promise((resolve, reject) => {
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

  if (submitRes.status !== 201) throw new Error(`Verification submit failed: ${JSON.stringify(submitRes.data)}`);
  const verificationId = submitRes.data._id;

  // Admin approves the verification
  const reviewRes = await request('PATCH', `/api/verification/${verificationId}/review`, {
    decision: 'verified', reviewNotes: 'Auto-approved for test',
  }, adminToken);
  if (reviewRes.status !== 200) throw new Error(`Verification approve failed: ${JSON.stringify(reviewRes.data)}`);

  return { token, userId };
}

/**
 * Full job lifecycle via API calls: create → post → assign → confirm agreement → work entries → confirm → lock → settlement.
 * Returns { jobId, settlementId, clientToken, photographerToken, adminToken }.
 */
async function createFullJobLifecycle() {
  const mongoose = require('/app/node_modules/mongoose');
  const admin = await createAdminUser();

  // Register alumni (client)
  const ts = Date.now();
  const client = await request('POST', '/api/auth/register', {
    username: `cli_${ts}`, email: `cli${ts}@t.com`, password: 'CliPass1234!',
  });
  const clientToken = client.data.token;
  const clientId = client.data.user._id;

  // Register & verify photographer
  const photog = await createVerifiedPhotographer(admin.token);

  // Client creates and posts a job
  const jobRes = await request('POST', '/api/jobs', {
    title: `Lifecycle Job ${ts}`, description: 'Full lifecycle test',
    jobType: 'event', rateType: 'hourly', agreedRateCents: 6000, estimatedTotalCents: 12000,
  }, clientToken);
  if (jobRes.status !== 201) throw new Error(`Job create failed: ${JSON.stringify(jobRes.data)}`);
  const jobId = jobRes.data._id;

  // Post the job (transition draft → posted)
  await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, clientToken);

  // Assign photographer
  const assignRes = await request('PATCH', `/api/jobs/${jobId}/assign`, {
    photographerId: photog.userId,
  }, clientToken);
  if (assignRes.status !== 200) throw new Error(`Assign failed: ${JSON.stringify(assignRes.data)}`);

  // Both confirm agreement
  await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'CliPass1234!' }, clientToken);
  await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'PhotPass123!' }, photog.token);

  // Photographer logs work entries
  const weRes = await request('POST', `/api/jobs/${jobId}/work-entries`, {
    entryType: 'time', durationMinutes: 120,
  }, photog.token);
  if (weRes.status !== 201) throw new Error(`Work entry failed: ${JSON.stringify(weRes.data)}`);
  const entryId = weRes.data._id;

  // Both confirm work entry via real API
  await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, photog.token);
  await request('PATCH', `/api/work-entries/${entryId}/confirm`, {}, clientToken);

  // With LOCK_HOURS=0 in the test env, lockAt is set to now on bilateral confirm.
  // Trigger the locking job (same code the cron runs) to lock the entry — no DB shortcut.
  await ensureMongooseConnected();
  const { lockWorkEntries } = require('/app/dist/jobs/workEntryLocking');
  await lockWorkEntries();

  // Generate settlement via API
  const settleRes = await request('POST', `/api/jobs/${jobId}/settlement`, {}, clientToken);
  if (settleRes.status !== 201) throw new Error(`Settlement generate failed: ${JSON.stringify(settleRes.data)}`);
  const settlementId = settleRes.data.settlement._id;

  return {
    jobId, settlementId, entryId,
    clientToken, clientId,
    photographerToken: photog.token, photographerId: photog.userId,
    adminToken: admin.token, adminId: admin.userId,
  };
}

/**
 * Submit a report with a single PDF evidence file (required as of F-003 fix).
 */
function submitReportWithEvidence(token, body) {
  return new Promise((resolve, reject) => {
    const boundary = '----RepBound' + Date.now();
    const pdf = Buffer.from('%PDF-1.4\n1 0 obj\nendobj\n');
    const parts = [];
    for (const [name, value] of Object.entries(body)) {
      parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`));
    }
    parts.push(Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="evidence"; filename="evidence.pdf"\r\nContent-Type: application/pdf\r\n\r\n`));
    parts.push(pdf);
    parts.push(Buffer.from(`\r\n--${boundary}--`));
    const b = Buffer.concat(parts);

    const url = new URL('/api/reports', BASE);
    const req = http.request({
      hostname: url.hostname, port: url.port, path: url.pathname, method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
        'Content-Length': b.length,
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
    req.write(b);
    req.end();
  });
}

module.exports = { request, createAdminUser, createVerifiedPhotographer, createFullJobLifecycle, submitReportWithEvidence, ensureMongooseConnected, BASE, MONGO_URI };
