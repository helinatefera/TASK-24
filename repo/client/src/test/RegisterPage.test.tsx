import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import RegisterPage from '../pages/RegisterPage';

const mockRegister = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ register: mockRegister, user: null, isAuthenticated: false }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderRegister() {
  return render(<MemoryRouter><RegisterPage /></MemoryRouter>);
}

function input(label: string) { return screen.getByText(label).parentElement!.querySelector('input, select')!; }

describe('RegisterPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders form fields and submit button', () => {
    renderRegister();
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByText('Role')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create account/i })).toBeInTheDocument();
  });

  it('defaults role to alumni', () => {
    renderRegister();
    expect((input('Role') as HTMLSelectElement).value).toBe('alumni');
  });

  it('calls register with form data and navigates on success', async () => {
    mockRegister.mockResolvedValueOnce(undefined);
    renderRegister();

    fireEvent.change(input('Username'), { target: { value: 'bob' } });
    fireEvent.change(input('Email'), { target: { value: 'bob@test.com' } });
    fireEvent.change(input('Password'), { target: { value: 'Strong123' } });
    fireEvent.change(input('Role'), { target: { value: 'photographer' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(mockRegister).toHaveBeenCalledWith({
        username: 'bob', email: 'bob@test.com', password: 'Strong123', role: 'photographer',
      });
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows server error on duplicate username', async () => {
    mockRegister.mockRejectedValueOnce({
      response: { data: { msg: 'A user with that email or username already exists' } },
    });
    renderRegister();

    fireEvent.change(input('Username'), { target: { value: 'dup' } });
    fireEvent.change(input('Email'), { target: { value: 'd@t.com' } });
    fireEvent.change(input('Password'), { target: { value: 'Pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText(/already exists/i)).toBeInTheDocument();
    });
  });

  it('shows generic fallback on network error', async () => {
    mockRegister.mockRejectedValueOnce(new Error('network'));
    renderRegister();

    fireEvent.change(input('Username'), { target: { value: 'x' } });
    fireEvent.change(input('Email'), { target: { value: 'x@t.com' } });
    fireEvent.change(input('Password'), { target: { value: 'Pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByText('Registration failed')).toBeInTheDocument();
    });
  });

  it('disables button while loading', async () => {
    mockRegister.mockImplementation(() => new Promise(() => {}));
    renderRegister();

    fireEvent.change(input('Username'), { target: { value: 'x' } });
    fireEvent.change(input('Email'), { target: { value: 'x@t.com' } });
    fireEvent.change(input('Password'), { target: { value: 'Pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /create account/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    });
  });

  it('has link to login page', () => {
    renderRegister();
    expect(screen.getByRole('link', { name: /sign in/i })).toHaveAttribute('href', '/login');
  });
});
