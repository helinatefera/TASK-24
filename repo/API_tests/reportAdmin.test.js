const { request, createAdminUser, submitReportWithEvidence } = require('./helpers');

describe('Admin Report Management — Status Transitions', () => {
  let adminToken;
  let userToken, userId;
  let reportId;

  beforeAll(async () => {
    const ts = Date.now();
    const admin = await createAdminUser();
    adminToken = admin.token;

    const user = await request('POST', '/api/auth/register', {
      username: `rpUser_${ts}`, email: `rp${ts}@t.com`, password: 'RpPass123!',
    });
    userToken = user.data.token;
    userId = user.data.user._id;

    // Grant consent needed for report creation
    await request('POST', '/api/consent/data-category', { category: 'account_identity' }, userToken);

    // Create a report (F-003: evidence attachment required)
    const rpt = await submitReportWithEvidence(userToken, {
      targetUserId: userId, category: 'spam', description: 'Test report for admin flow',
    });
    reportId = rpt.data._id;
  });

  test('Report starts in submitted status', async () => {
    const res = await request('GET', '/api/admin/reports', null, adminToken);
    expect(res.status).toBe(200);
    const found = (res.data.items || []).find(r => r._id === reportId);
    expect(found).toBeDefined();
    expect(found.status).toBe('submitted');
  });

  test('Transition submitted → under_review succeeds', async () => {
    const res = await request('PATCH', `/api/admin/reports/${reportId}`, {
      status: 'under_review',
      notes: 'Starting investigation',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('under_review');
  });

  test('Invalid transition under_review → submitted is rejected', async () => {
    const res = await request('PATCH', `/api/admin/reports/${reportId}`, {
      status: 'submitted',
      notes: 'Invalid backtrack',
    }, adminToken);
    expect(res.status).toBe(400);
  });

  test('Transition under_review → action_taken succeeds', async () => {
    const res = await request('PATCH', `/api/admin/reports/${reportId}`, {
      status: 'action_taken',
      notes: 'User warned',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('action_taken');
  });

  test('Transition action_taken → closed succeeds', async () => {
    const res = await request('PATCH', `/api/admin/reports/${reportId}`, {
      status: 'closed',
      notes: 'Case resolved',
    }, adminToken);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('closed');
  });

  test('Frontend-incompatible status "investigating" is rejected by schema', async () => {
    // Create another report to test against (F-003: evidence required)
    const rpt2 = await submitReportWithEvidence(userToken, {
      targetUserId: userId, category: 'harassment', description: 'Second test report',
    });
    const res = await request('PATCH', `/api/admin/reports/${rpt2.data._id}`, {
      status: 'investigating',
      notes: 'Old frontend status',
    }, adminToken);
    expect(res.status).toBe(400);
  });

  test('Non-admin cannot review report → 403', async () => {
    const res = await request('PATCH', `/api/admin/reports/${reportId}`, {
      status: 'closed',
    }, userToken);
    expect(res.status).toBe(403);
  });
});
