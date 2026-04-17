const { request, createAdminUser, createVerifiedPhotographer } = require('./helpers');

describe('Content Review Decision Flow', () => {
  let adminToken;
  let clientToken, clientId;
  let photographerToken, photographerId;
  let jobId;
  let reviewId;

  beforeAll(async () => {
    const ts = Date.now();

    const admin = await createAdminUser();
    adminToken = admin.token;

    const user = await request('POST', '/api/auth/register', {
      username: `crUser_${ts}`, email: `cr${ts}@t.com`, password: 'CrPass123!',
    });
    clientToken = user.data.token;
    clientId = user.data.user._id;

    // Verified photographer for messaging
    const photog = await createVerifiedPhotographer(adminToken);
    photographerToken = photog.token;
    photographerId = photog.userId;

    // Create a job and get to in_progress so messages work
    const jobRes = await request('POST', '/api/jobs', {
      title: 'CR Test Job', description: 'Content review trigger test',
      jobType: 'portrait', rateType: 'piece_rate', agreedRateCents: 5000, estimatedTotalCents: 10000,
    }, clientToken);
    jobId = jobRes.data._id;
    await request('PUT', `/api/jobs/${jobId}`, { status: 'posted' }, clientToken);
    await request('PATCH', `/api/jobs/${jobId}/assign`, { photographerId }, clientToken);
    await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'CrPass123!' }, clientToken);
    await request('POST', `/api/jobs/${jobId}/agreement/confirm`, { password: 'PhotPass123!' }, photographerToken);

    // Add a sensitive word via admin API so the content filter can flag it
    await request('POST', '/api/admin/sensitive-words', {
      word: 'badtestword', severity: 'high',
    }, adminToken);

    // Send a message containing the flagged word — triggers content review creation
    const msgRes = await request('POST', `/api/jobs/${jobId}/messages`, {
      messageText: 'This message contains badtestword and should be flagged',
    }, photographerToken);
    // Message should succeed (content filter flags but doesn't block)
    expect(msgRes.status).toBe(201);

    // The content filter should have created a pending content review
    const reviewsRes = await request('GET', '/api/admin/content-reviews', null, adminToken);
    const pending = (reviewsRes.data.items || reviewsRes.data || []).find(
      r => r.status === 'pending' && r.flaggedWords && r.flaggedWords.includes('badtestword')
    );
    if (pending) {
      reviewId = pending._id;
    }
  }, 60000);

  test('Content review was created by the content filter', () => {
    expect(reviewId).toBeDefined();
  });

  test('Admin can list pending reviews', async () => {
    const res = await request('GET', '/api/admin/content-reviews', null, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.items).toBeDefined();
  });

  test('Non-admin cannot list reviews → 403', async () => {
    const res = await request('GET', '/api/admin/content-reviews', null, clientToken);
    expect(res.status).toBe(403);
  });

  test('Admin can approve review with {status, reviewNotes}', async () => {
    const res = await request('PATCH', `/api/admin/content-reviews/${reviewId}`, {
      status: 'approved',
      reviewNotes: 'Content is fine after inspection',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('approved');
  });

  test('Admin can reject review with {decision, reason} (frontend shape)', async () => {
    // Trigger another content review via a new flagged message
    await request('POST', `/api/jobs/${jobId}/messages`, {
      messageText: 'Another badtestword message for rejection test',
    }, photographerToken);

    const reviewsRes = await request('GET', '/api/admin/content-reviews?status=pending', null, adminToken);
    const pending = (reviewsRes.data.items || reviewsRes.data || []).find(r => r.status === 'pending');
    expect(pending).toBeDefined();

    const res = await request('PATCH', `/api/admin/content-reviews/${pending._id}`, {
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
    }, clientToken);
    expect(res.status).toBe(403);
  });

  test('Cannot reject already-approved content → 400', async () => {
    // reviewId was approved earlier — attempt to reject it now
    const res = await request('PATCH', `/api/admin/content-reviews/${reviewId}`, {
      decision: 'rejected',
      reason: 'Changed my mind',
    }, adminToken);
    expect(res.status).toBe(400);
    expect(res.data.msg).toMatch(/pending/i);
  });

  test('Cannot approve already-rejected content → 400', async () => {
    // Trigger yet another review and reject it, then try to approve
    await request('POST', `/api/jobs/${jobId}/messages`, {
      messageText: 'Third badtestword message for double-action test',
    }, photographerToken);

    const reviewsRes = await request('GET', '/api/admin/content-reviews?status=pending', null, adminToken);
    const pending = (reviewsRes.data.items || reviewsRes.data || []).find(r => r.status === 'pending');
    expect(pending).toBeDefined();

    // Reject it
    const rejectRes = await request('PATCH', `/api/admin/content-reviews/${pending._id}`, {
      status: 'rejected', reviewNotes: 'Not appropriate',
    }, adminToken);
    expect(rejectRes.status).toBe(200);

    // Now try to approve — should fail
    const approveRes = await request('PATCH', `/api/admin/content-reviews/${pending._id}`, {
      status: 'approved', reviewNotes: 'Actually it was fine',
    }, adminToken);
    expect(approveRes.status).toBe(400);
    expect(approveRes.data.msg).toMatch(/pending/i);
  });
});
