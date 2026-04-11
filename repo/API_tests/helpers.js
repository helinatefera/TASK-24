const http = require('http');
const crypto = require('crypto');

const BASE = process.env.API_BASE || 'http://server:3001';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://mongo:27017/lenswork';

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
        try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
        catch { resolve({ status: res.statusCode, data }); }
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

  // Promote to admin directly in the DB via mongoose
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

module.exports = { request, createAdminUser, BASE };
