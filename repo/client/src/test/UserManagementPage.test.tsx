import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import UserManagementPage from '../pages/admin/UserManagementPage';

vi.mock('../api/admin.api', () => ({
  adminApi: {
    getUsers: vi.fn(),
    updateUserRole: vi.fn(),
    updateUserStatus: vi.fn(),
  },
}));
import { adminApi } from '../api/admin.api';

const USERS = [
  { _id: 'u1', username: 'alice', email: 'alice@test.com', role: 'alumni', accountStatus: 'active' },
  { _id: 'u2', username: 'bob', email: 'bob@test.com', role: 'photographer', accountStatus: 'active' },
  { _id: 'u3', username: 'charlie', email: 'charlie@test.com', role: 'admin', accountStatus: 'suspended' },
];

function renderPage() {
  return render(<MemoryRouter><UserManagementPage /></MemoryRouter>);
}

describe('UserManagementPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders user table after loading', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: USERS });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('alice')).toBeInTheDocument();
      expect(screen.getByText('bob')).toBeInTheDocument();
      expect(screen.getByText('charlie')).toBeInTheDocument();
    });
  });

  it('shows empty state when no users', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/no users found/i)).toBeInTheDocument();
    });
  });

  it('shows error on API failure', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { msg: 'Forbidden' } },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Forbidden')).toBeInTheDocument();
    });
  });

  it('calls updateUserRole when role dropdown changes', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: USERS });
    (adminApi.updateUserRole as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText('alice'));

    // Find alice's role dropdown (first one with value 'alumni')
    const roleSelects = screen.getAllByDisplayValue('Alumni');
    fireEvent.change(roleSelects[0], { target: { value: 'photographer' } });

    await waitFor(() => {
      expect(adminApi.updateUserRole).toHaveBeenCalledWith('u1', 'photographer');
    });
  });

  it('shows Suspend button for active users', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: USERS });
    renderPage();
    await waitFor(() => screen.getByText('alice'));

    const suspendButtons = screen.getAllByText('Suspend');
    expect(suspendButtons.length).toBe(2); // alice and bob (active)
  });

  it('shows Activate button for suspended users', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: USERS });
    renderPage();
    await waitFor(() => screen.getByText('charlie'));

    expect(screen.getByText('Activate')).toBeInTheDocument();
  });

  it('calls updateUserStatus when Suspend clicked', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: USERS });
    (adminApi.updateUserStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText('alice'));

    fireEvent.click(screen.getAllByText('Suspend')[0]);

    await waitFor(() => {
      expect(adminApi.updateUserStatus).toHaveBeenCalledWith('u1', 'suspended');
    });
  });

  it('calls updateUserStatus when Activate clicked', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: USERS });
    (adminApi.updateUserStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText('charlie'));

    fireEvent.click(screen.getByText('Activate'));

    await waitFor(() => {
      expect(adminApi.updateUserStatus).toHaveBeenCalledWith('u3', 'active');
    });
  });

  it('has search input and role filter', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: USERS });
    renderPage();
    await waitFor(() => screen.getByText('alice'));

    expect(screen.getByPlaceholderText(/search users/i)).toBeInTheDocument();
    expect(screen.getByDisplayValue('All Roles')).toBeInTheDocument();
  });

  it('refetches when search changes', async () => {
    (adminApi.getUsers as ReturnType<typeof vi.fn>).mockResolvedValue({ data: USERS });
    renderPage();
    await waitFor(() => screen.getByText('alice'));

    fireEvent.change(screen.getByPlaceholderText(/search users/i), { target: { value: 'alice' } });

    await waitFor(() => {
      expect(adminApi.getUsers).toHaveBeenCalledWith(expect.objectContaining({ search: 'alice' }));
    });
  });
});
