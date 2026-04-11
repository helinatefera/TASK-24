import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AccessRequestsPage from '../pages/AccessRequestsPage';

const mockGet = vi.fn();
const mockPatch = vi.fn();
const mockPost = vi.fn();

vi.mock('../api/client', () => ({
  default: {
    get: (...args: any[]) => mockGet(...args),
    patch: (...args: any[]) => mockPatch(...args),
    post: (...args: any[]) => mockPost(...args),
  },
}));

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: 'user1', role: 'alumni' } }),
}));

const INCOMING = [
  { _id: 'r1', requesterId: 'u2', fields: ['email', 'phone'], reason: 'Need contact info', status: 'pending', createdAt: '2026-01-01' },
  { _id: 'r2', requesterId: 'u3', fields: ['location'], reason: 'Collaboration', status: 'approved', createdAt: '2026-01-02' },
];

function setupApi(incoming: any[] = INCOMING, outgoing: any[] = []) {
  mockGet.mockImplementation((url: string) => {
    if (url.includes('incoming')) return Promise.resolve({ data: incoming });
    if (url.includes('outgoing')) return Promise.resolve({ data: outgoing });
    return Promise.reject(new Error('unexpected'));
  });
}

function renderPage() {
  return render(<MemoryRouter><AccessRequestsPage /></MemoryRouter>);
}

describe('AccessRequestsPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders incoming requests with fields and reason', async () => {
    setupApi();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('email, phone')).toBeInTheDocument();
      expect(screen.getByText('Need contact info')).toBeInTheDocument();
    });
  });

  it('shows Approve/Deny buttons only for pending requests', async () => {
    setupApi();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Approve')).toBeInTheDocument();
      expect(screen.getByText('Deny')).toBeInTheDocument();
    });
    // The approved request (r2) should not have Approve/Deny buttons
    // Both buttons exist once (only for r1)
    expect(screen.getAllByText('Approve')).toHaveLength(1);
    expect(screen.getAllByText('Deny')).toHaveLength(1);
  });

  it('calls approve API when Approve clicked', async () => {
    setupApi();
    mockPatch.mockResolvedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText('Approve'));

    fireEvent.click(screen.getByText('Approve'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/access-requests/r1/approve');
    });
  });

  it('calls deny API when Deny clicked', async () => {
    setupApi();
    mockPatch.mockResolvedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText('Deny'));

    fireEvent.click(screen.getByText('Deny'));

    await waitFor(() => {
      expect(mockPatch).toHaveBeenCalledWith('/access-requests/r1/deny');
    });
  });

  it('switches between incoming and outgoing tabs', async () => {
    setupApi(INCOMING, [{ _id: 'r3', targetUserId: 'u5', fields: ['email'], reason: 'Outgoing', status: 'pending', createdAt: '2026-01-03' }]);
    renderPage();
    await waitFor(() => screen.getByText('Need contact info'));

    fireEvent.click(screen.getByRole('button', { name: /outgoing/i }));
    await waitFor(() => {
      expect(screen.getByText('Outgoing')).toBeInTheDocument();
    });
  });

  it('shows empty state when no requests', async () => {
    setupApi([], []);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no incoming requests/i)).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    mockGet.mockRejectedValue({ response: { data: { msg: 'Unauthorized' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Unauthorized')).toBeInTheDocument();
    });
  });

  it('toggles new request form and submits', async () => {
    setupApi();
    renderPage();
    await waitFor(() => screen.getByText('Need contact info'));

    fireEvent.click(screen.getByRole('button', { name: /new request/i }));
    expect(screen.getByText('Target User ID')).toBeInTheDocument();

    mockPost.mockResolvedValueOnce({});
    const form = screen.getByText('Target User ID').closest('form')!;
    fireEvent.change(form.querySelectorAll('input')[0], { target: { value: 'u99' } });
    fireEvent.change(form.querySelectorAll('input')[1], { target: { value: 'email, phone' } });
    fireEvent.change(form.querySelector('textarea')!, { target: { value: 'Need info' } });
    fireEvent.click(screen.getByRole('button', { name: /submit request/i }));

    await waitFor(() => {
      expect(mockPost).toHaveBeenCalledWith('/access-requests', {
        targetUserId: 'u99',
        fields: ['email', 'phone'],
        reason: 'Need info',
      });
    });
  });
});
