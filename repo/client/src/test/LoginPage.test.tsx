import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import LoginPage from '../pages/LoginPage';

const mockLogin = vi.fn();
const mockNavigate = vi.fn();

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin, user: null, isAuthenticated: false }),
}));
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

function renderLogin() {
  return render(<MemoryRouter><LoginPage /></MemoryRouter>);
}

function usernameInput() { return screen.getByText('Username').parentElement!.querySelector('input')!; }
function passwordInput() { return screen.getByText('Password').parentElement!.querySelector('input')!; }

describe('LoginPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders login form with username, password, and submit button', () => {
    renderLogin();
    expect(screen.getByText('Username')).toBeInTheDocument();
    expect(screen.getByText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('calls login and navigates on successful submit', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    renderLogin();

    fireEvent.change(usernameInput(), { target: { value: 'alice' } });
    fireEvent.change(passwordInput(), { target: { value: 'Pass1234' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(mockLogin).toHaveBeenCalledWith('alice', 'Pass1234');
      expect(mockNavigate).toHaveBeenCalledWith('/');
    });
  });

  it('shows error message on login failure', async () => {
    mockLogin.mockRejectedValueOnce({ response: { data: { msg: 'Invalid email or password' } } });
    renderLogin();

    fireEvent.change(usernameInput(), { target: { value: 'alice' } });
    fireEvent.change(passwordInput(), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('shows generic fallback error when response has no msg', async () => {
    mockLogin.mockRejectedValueOnce(new Error('network'));
    renderLogin();

    fireEvent.change(usernameInput(), { target: { value: 'a' } });
    fireEvent.change(passwordInput(), { target: { value: 'p' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Login failed')).toBeInTheDocument();
    });
  });

  it('disables button and shows spinner text while loading', async () => {
    mockLogin.mockImplementation(() => new Promise(() => {}));
    renderLogin();

    fireEvent.change(usernameInput(), { target: { value: 'a' } });
    fireEvent.change(passwordInput(), { target: { value: 'p' } });
    fireEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
    });
  });

  it('has link to register page', () => {
    renderLogin();
    expect(screen.getByRole('link', { name: /register/i })).toHaveAttribute('href', '/register');
  });
});
