const { request } = require('./helpers');

describe('Job API', () => {
  let alumniToken;
  let jobId;

  beforeAll(async () => {
    const res = await request('POST', '/api/auth/register', { username: `alumni_${Date.now()}`, email: `a${Date.now()}@t.com`, password: 'TestPass123!' });
    alumniToken = res.data.token;
  });

  test('POST /api/jobs creates a job', async () => {
    const res = await request('POST', '/api/jobs', {
      title: 'Event Photography',
      description: 'Need photos for graduation',
      jobType: 'event',
      rateType: 'hourly',
      agreedRateCents: 5000,
      estimatedTotalCents: 20000,
    }, alumniToken);
    expect(res.status).toBe(201);
    expect(res.data.title).toBe('Event Photography');
    expect(res.data.jobType).toBe('event');
    jobId = res.data._id;
  });

  test('GET /api/jobs lists jobs', async () => {
    const res = await request('GET', '/api/jobs', null, alumniToken);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.data.jobs || res.data.items || res.data)).toBe(true);
  });

  test('GET /api/jobs/:id gets job details', async () => {
    const res = await request('GET', `/api/jobs/${jobId}`, null, alumniToken);
    expect(res.status).toBe(200);
    expect(res.data._id).toBe(jobId);
  });

  test('POST /api/jobs validates required fields', async () => {
    const res = await request('POST', '/api/jobs', { title: '' }, alumniToken);
    expect(res.status).toBe(400);
    expect(res.data.msg).toBeDefined();
  });

  test('PUT /api/jobs/:id validates input', async () => {
    const res = await request('PUT', `/api/jobs/${jobId}`, { title: '' }, alumniToken);
    expect(res.status).toBe(400);
  });

  test('Agreement confirmation requires password', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/agreement/confirm`, {}, alumniToken);
    expect(res.status).toBe(400);
    expect(res.data.msg).toContain('Password is required');
  });

  test('Agreement confirmation with wrong password fails', async () => {
    const res = await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'WrongPassword99!' }, alumniToken);
    expect(res.status).toBe(401);
  });
});
