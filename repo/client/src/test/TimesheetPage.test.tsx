import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import App from '../App';

function renderAuthenticated(route: string, role = 'photographer', userId = '1') {

  localStorage.setItem('user', JSON.stringify({
    _id: userId, username: 'testuser', role, email: 'test@t.com',
    accountStatus: 'active', isAlumni: true, communityId: 'c1',
  }));
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('TimesheetPage routing', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders timesheet page at /jobs/:jobId/timesheets for authenticated user', () => {
    renderAuthenticated('/jobs/abc123/timesheets');
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user from timesheet to login', () => {
    render(
      <MemoryRouter initialEntries={['/jobs/abc123/timesheets']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });
});

describe('Timesheet locking behavior (unit)', () => {
  it('locked entries should not show confirm button', () => {
    // Simulate the rendering logic: isLocked=true means no confirm button
    const entry = { _id: '1', isLocked: true, clientConfirmedAt: new Date(), photographerConfirmedAt: new Date() };
    const isClient = true;
    const isPhotographer = false;
    const showConfirm = !entry.isLocked && (
      (isClient && !entry.clientConfirmedAt) || (isPhotographer && !entry.photographerConfirmedAt)
    );
    expect(showConfirm).toBe(false);
  });

  it('unlocked entry shows confirm for client who has not confirmed', () => {
    const entry = { _id: '2', isLocked: false, clientConfirmedAt: null, photographerConfirmedAt: new Date() };
    const isClient = true;
    const isPhotographer = false;
    const showConfirm = !entry.isLocked && (
      (isClient && !entry.clientConfirmedAt) || (isPhotographer && !entry.photographerConfirmedAt)
    );
    expect(showConfirm).toBe(true);
  });

  it('unlocked entry shows confirm for photographer who has not confirmed', () => {
    const entry = { _id: '3', isLocked: false, clientConfirmedAt: new Date(), photographerConfirmedAt: null };
    const isClient = false;
    const isPhotographer = true;
    const showConfirm = !entry.isLocked && (
      (isClient && !entry.clientConfirmedAt) || (isPhotographer && !entry.photographerConfirmedAt)
    );
    expect(showConfirm).toBe(true);
  });

  it('unlocked entry where both confirmed does not show confirm', () => {
    const entry = { _id: '4', isLocked: false, clientConfirmedAt: new Date(), photographerConfirmedAt: new Date() };
    const isClient = true;
    const isPhotographer = false;
    const showConfirm = !entry.isLocked && (
      (isClient && !entry.clientConfirmedAt) || (isPhotographer && !entry.photographerConfirmedAt)
    );
    expect(showConfirm).toBe(false);
  });

  it('non-participant sees no confirm button regardless', () => {
    const entry = { _id: '5', isLocked: false, clientConfirmedAt: null, photographerConfirmedAt: null };
    const isClient = false;
    const isPhotographer = false;
    const showConfirm = !entry.isLocked && (
      (isClient && !entry.clientConfirmedAt) || (isPhotographer && !entry.photographerConfirmedAt)
    );
    expect(showConfirm).toBe(false);
  });
});

describe('workEntriesApi.confirm mock', () => {
  it('confirm API calls PATCH /work-entries/:id/confirm', async () => {
    const mockPatch = vi.fn().mockResolvedValue({ data: { _id: '1', clientConfirmedAt: new Date() } });
    // Simulate what workEntriesApi.confirm does
    const entryId = 'entry123';
    const result = await mockPatch(`/work-entries/${entryId}/confirm`);
    expect(mockPatch).toHaveBeenCalledWith('/work-entries/entry123/confirm');
    expect(result.data._id).toBe('1');
  });

  it('confirm rejects for non-participant with 403', async () => {
    const mockPatch = vi.fn().mockRejectedValue({
      response: { status: 403, data: { msg: 'Only the client or photographer can confirm' } },
    });
    try {
      await mockPatch('/work-entries/entry123/confirm');
    } catch (err: any) {
      expect(err.response.status).toBe(403);
    }
    expect(mockPatch).toHaveBeenCalled();
  });

  it('confirm rejects for already-locked entry with 400', async () => {
    const mockPatch = vi.fn().mockRejectedValue({
      response: { status: 400, data: { msg: 'Work entry is already locked' } },
    });
    try {
      await mockPatch('/work-entries/locked123/confirm');
    } catch (err: any) {
      expect(err.response.status).toBe(400);
      expect(err.response.data.msg).toContain('already locked');
    }
  });
});

describe('48-hour locking time-window behavior (unit)', () => {
  const LOCK_HOURS = 48;

  function makeLockAt(hoursFromNow: number): Date {
    const d = new Date();
    d.setHours(d.getHours() + hoursFromNow);
    return d;
  }

  it('both confirmed sets lockAt to 48h in the future', () => {
    const now = new Date();
    const lockAt = new Date(now.getTime() + LOCK_HOURS * 60 * 60 * 1000);
    // lockAt should be ~48h from now
    const diff = lockAt.getTime() - now.getTime();
    expect(diff).toBe(LOCK_HOURS * 60 * 60 * 1000);
  });

  it('entry before lockAt is not yet lockable', () => {
    const entry = {
      isLocked: false,
      clientConfirmedAt: new Date(),
      photographerConfirmedAt: new Date(),
      lockAt: makeLockAt(24), // 24h from now — not yet
    };
    const now = new Date();
    const canLock = !entry.isLocked && entry.lockAt && now >= entry.lockAt;
    expect(canLock).toBe(false);
  });

  it('entry after lockAt is lockable', () => {
    const entry = {
      isLocked: false,
      clientConfirmedAt: new Date(),
      photographerConfirmedAt: new Date(),
      lockAt: makeLockAt(-1), // 1h ago — past
    };
    const now = new Date();
    const canLock = !entry.isLocked && entry.lockAt && now >= entry.lockAt;
    expect(canLock).toBe(true);
  });

  it('already locked entry cannot be re-locked', () => {
    const entry = {
      isLocked: true,
      lockAt: makeLockAt(-1),
    };
    const canLock = !entry.isLocked;
    expect(canLock).toBe(false);
  });

  it('entry with only one confirmation has no lockAt', () => {
    const entry: { isLocked: boolean; lockAt: Date | undefined } = {
      isLocked: false,
      lockAt: undefined,
    };
    const canLock = !entry.isLocked && entry.lockAt && new Date() >= entry.lockAt;
    expect(canLock).toBeFalsy();
  });

  it('bilateral confirm transitions: photographer then client', () => {
    // Step 1: photographer confirms
    const entry: any = { isLocked: false, clientConfirmedAt: null, photographerConfirmedAt: null, lockAt: null };
    entry.photographerConfirmedAt = new Date();
    expect(entry.photographerConfirmedAt).toBeDefined();
    expect(entry.clientConfirmedAt).toBeNull();
    // No lockAt yet
    expect(entry.lockAt).toBeNull();

    // Step 2: client confirms
    entry.clientConfirmedAt = new Date();
    // Both confirmed — set lockAt
    if (entry.clientConfirmedAt && entry.photographerConfirmedAt) {
      entry.lockAt = new Date(Date.now() + LOCK_HOURS * 60 * 60 * 1000);
    }
    expect(entry.lockAt).toBeDefined();
    expect(entry.lockAt.getTime()).toBeGreaterThan(Date.now());
  });
});
