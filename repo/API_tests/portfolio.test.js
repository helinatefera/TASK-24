const { request, createAdminUser } = require('./helpers');
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

// Generate a real JPEG that sharp can process for watermark tests
let VALID_JPEG;
beforeAll(async () => {
  const sharp = require('/app/node_modules/sharp');
  VALID_JPEG = await sharp({ create: { width: 100, height: 100, channels: 3, background: { r: 128, g: 128, b: 128 } } }).jpeg().toBuffer();
});

describe('H-03 & H-05: Portfolio Contract & Watermark Preview', () => {
  let photographerToken, photographerId;
  let alumniToken;
  let portfolioId;

  beforeAll(async () => {
    const ts = Date.now();
    const photog = await request('POST', '/api/auth/register', {
      username: `h03Phot_${ts}`, email: `h03p${ts}@t.com`, password: 'PhotPass123!', role: 'photographer',
    });
    photographerToken = photog.data.token;
    photographerId = photog.data.user._id;

    const alumni = await request('POST', '/api/auth/register', {
      username: `h03Alum_${ts}`, email: `h03a${ts}@t.com`, password: 'AlumPass123!',
    });
    alumniToken = alumni.data.token;

    const port = await request('POST', '/api/portfolios', {
      title: 'H03 Test Portfolio', description: 'Contract & watermark test',
    }, photographerToken);
    portfolioId = port.data._id;
  });

  // --- H-03: Portfolio detail contract ---

  test('Portfolio detail returns images array with {id, url, previewUrl, metadata}', async () => {
    const res = await request('GET', `/api/portfolios/${portfolioId}`, null, photographerToken);
    expect(res.status).toBe(200);
    expect(res.data.title).toBe('H03 Test Portfolio');
    expect(res.data).toHaveProperty('images');
    expect(Array.isArray(res.data.images)).toBe(true);
  });

  test('Portfolio list returns {portfolios: [...]}', async () => {
    const res = await request('GET', '/api/portfolios', null, photographerToken);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('portfolios');
    expect(Array.isArray(res.data.portfolios)).toBe(true);
  });

  // --- H-05: Watermark preview ---

  test('Upload with watermarkEnabled=true → 201, previewUrl differs from url', async () => {
    const res = await multipartUpload(
      `/api/portfolios/${portfolioId}/images`, photographerToken,
      { copyrightNotice: '(c) 2026 Test', caption: 'Watermarked', watermarkEnabled: 'true' },
      { name: 'image', filename: 'wm.jpg', contentType: 'image/jpeg', buffer: VALID_JPEG },
    );
    expect(res.status).toBe(201);
    expect(res.data.id).toBeDefined();
    expect(res.data.url).toBeDefined();
    expect(res.data.previewUrl).toBeDefined();
    expect(res.data.watermarkEnabled).toBe(true);
    expect(res.data.copyrightNotice).toBe('(c) 2026 Test');
    expect(res.data.caption).toBe('Watermarked');
    // previewUrl should differ from url when watermark is applied
    expect(res.data.previewUrl).not.toBe(res.data.url);
  });

  test('Upload with watermarkEnabled=false → 201, previewUrl equals url', async () => {
    const res = await multipartUpload(
      `/api/portfolios/${portfolioId}/images`, photographerToken,
      { copyrightNotice: 'No WM', watermarkEnabled: 'false' },
      { name: 'image', filename: 'nowm.jpg', contentType: 'image/jpeg', buffer: VALID_JPEG },
    );
    expect(res.status).toBe(201);
    expect(res.data.watermarkEnabled).toBe(false);
    expect(res.data.previewUrl).toBe(res.data.url);
  });

  test('Portfolio detail includes uploaded images with normalized shape', async () => {
    const res = await request('GET', `/api/portfolios/${portfolioId}`, null, photographerToken);
    expect(res.status).toBe(200);
    expect(res.data.images.length).toBeGreaterThanOrEqual(2);
    const img = res.data.images[0];
    expect(img).toHaveProperty('id');
    expect(img).toHaveProperty('url');
    expect(img).toHaveProperty('previewUrl');
    expect(img).toHaveProperty('caption');
    expect(img).toHaveProperty('copyrightNotice');
    expect(img).toHaveProperty('watermarkEnabled');
    expect(img).toHaveProperty('mimeType');
  });

  test('GET /:id/images returns {images: [...]} with same shape', async () => {
    const res = await request('GET', `/api/portfolios/${portfolioId}/images`, null, photographerToken);
    expect(res.status).toBe(200);
    expect(res.data).toHaveProperty('images');
    expect(Array.isArray(res.data.images)).toBe(true);
    expect(res.data.images.length).toBeGreaterThanOrEqual(2);
    expect(res.data.images[0]).toHaveProperty('id');
    expect(res.data.images[0]).toHaveProperty('previewUrl');
  });

  test('Non-photographer cannot upload → 403', async () => {
    const res = await multipartUpload(
      `/api/portfolios/${portfolioId}/images`, alumniToken,
      { copyrightNotice: 'Test' },
      { name: 'image', filename: 'test.jpg', contentType: 'image/jpeg', buffer: VALID_JPEG },
    );
    expect(res.status).toBe(403);
  });

  test('Image removal by owner → 200', async () => {
    const listRes = await request('GET', `/api/portfolios/${portfolioId}/images`, null, photographerToken);
    expect(listRes.data.images.length).toBeGreaterThan(0);
    const imageId = listRes.data.images[0].id;
    const delRes = await request('DELETE', `/api/portfolios/${portfolioId}/images/${imageId}`, null, photographerToken);
    expect(delRes.status).toBe(200);
  });
});
