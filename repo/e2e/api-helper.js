/**
 * HTTP + DB helper for E2E tests. Drives backend setup from Playwright specs.
 *
 * Most operations use real API calls (HTTPS to the nginx proxy or HTTP to the
 * server). Admin promotion uses a direct MongoDB write — same mechanism
 * documented in README (mongosh) and used by the API test helpers.
 *
 * The E2E container runs on the Docker compose network and can reach both
 * the nginx proxy (https://client:443) and MongoDB (mongodb://mongo:27017).
 */
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const BASE = process.env.E2E_BASE_URL || 'https://localhost:3443';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';
// For authenticated MongoDB in test env:
const MONGO_USER = process.env.MONGO_INITDB_ROOT_USERNAME || '';
const MONGO_PASS = process.env.MONGO_INITDB_ROOT_PASSWORD || '';
const MONGO_CONN = MONGO_USER
  ? `mongodb://${MONGO_USER}:${MONGO_PASS}@mongo:27017/lenswork?authSource=admin`
  : MONGO_URI;

function apiRequest(method, path, body, token) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE);
    const isHttps = url.protocol === 'https:';
    const mod = isHttps ? https : http;
    const apiPath = '/api' + path.replace(/^\/api/, '');
    const options = {
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: apiPath,
      method,
      rejectUnauthorized: false,
      headers: {
        'Content-Type': 'application/json',
        'X-Nonce': crypto.randomUUID(),
        'X-Timestamp': Date.now().toString(),
      },
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;
    const req = mod.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function registerUser(username, email, password, role = 'alumni') {
  const res = await apiRequest('POST', '/auth/register', { username, email, password, role });
  if (res.status !== 201) throw new Error(`Register failed (${res.status}): ${JSON.stringify(res.data)}`);
  return { token: res.data.token, userId: res.data.user._id, username, password };
}

async function loginUser(username, password) {
  const res = await apiRequest('POST', '/auth/login', { username, password });
  if (res.status !== 200) throw new Error(`Login failed: ${JSON.stringify(res.data)}`);
  return { token: res.data.token, userId: res.data.user._id };
}

/**
 * Register + promote to admin + re-login. Uses direct MongoDB write for the
 * promotion step (same as README mongosh docs and API test helpers).
 * Returns { token, userId, username, password }.
 */
async function createAdminUser() {
  let mongoose;
  try { mongoose = require('mongoose'); } catch { mongoose = null; }

  const ts = Date.now();
  const username = `e2eAdm_${ts}`;
  const password = 'E2eAdmin1!';
  const reg = await registerUser(username, `e2eadm${ts}@t.com`, password);

  if (mongoose) {
    const conn = await mongoose.createConnection(MONGO_CONN).asPromise();
    try {
      await conn.collection('users').updateOne(
        { _id: new mongoose.Types.ObjectId(reg.userId) },
        { $set: { role: 'admin' } },
      );
    } finally { await conn.close(); }
    const login = await loginUser(username, password);
    return { ...login, username, password };
  }

  // Without mongoose, return unpromoted user — tests should handle gracefully
  return { ...reg, username, password, unpromoted: true };
}

async function grantConsent(token, category) {
  return apiRequest('POST', '/consent/data-category', { category }, token);
}

async function createJob(token, title, opts = {}) {
  const res = await apiRequest('POST', '/jobs', {
    title,
    description: opts.description || 'E2E test job',
    jobType: opts.jobType || 'event',
    rateType: opts.rateType || 'hourly',
    agreedRateCents: opts.agreedRateCents || 5000,
    estimatedTotalCents: opts.estimatedTotalCents || 10000,
  }, token);
  if (res.status !== 201) throw new Error(`Job create failed: ${JSON.stringify(res.data)}`);
  return res.data._id;
}

async function postAndAssignJob(clientToken, jobId, photographerId, clientPassword, photographerToken, photographerPassword) {
  await apiRequest('PUT', `/jobs/${jobId}`, { status: 'posted' }, clientToken);
  await apiRequest('PATCH', `/jobs/${jobId}/assign`, { photographerId }, clientToken);
  await apiRequest('POST', `/jobs/${jobId}/agreement/confirm`, { password: clientPassword }, clientToken);
  await apiRequest('POST', `/jobs/${jobId}/agreement/confirm`, { password: photographerPassword }, photographerToken);
}

async function createWorkEntry(token, jobId, durationMinutes) {
  const res = await apiRequest('POST', `/jobs/${jobId}/work-entries`, {
    entryType: 'time', durationMinutes,
  }, token);
  if (res.status !== 201) throw new Error(`Work entry failed: ${JSON.stringify(res.data)}`);
  return res.data._id;
}

async function confirmWorkEntry(token, entryId) {
  return apiRequest('PATCH', `/work-entries/${entryId}/confirm`, {}, token);
}

async function generateSettlement(token, jobId) {
  const res = await apiRequest('POST', `/jobs/${jobId}/settlement`, {}, token);
  if (res.status !== 201) throw new Error(`Settlement failed: ${JSON.stringify(res.data)}`);
  return res.data.settlement._id;
}

async function submitReport(token, targetUserId, category, description) {
  return apiRequest('POST', '/reports', { targetUserId, category, description }, token);
}

async function addSensitiveWord(adminToken, word) {
  return apiRequest('POST', '/admin/sensitive-words', { word, severity: 'high' }, adminToken);
}

async function publishPrivacyPolicy(adminToken, version) {
  return apiRequest('POST', '/admin/privacy-policies', {
    version, content: 'E2E test policy', effectiveDate: new Date().toISOString(), purposes: ['general'],
  }, adminToken);
}

module.exports = {
  apiRequest, registerUser, loginUser, createAdminUser,
  grantConsent, createJob, postAndAssignJob,
  createWorkEntry, confirmWorkEntry, generateSettlement,
  submitReport, addSensitiveWord, publishPrivacyPolicy,
};
