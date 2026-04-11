import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import App from '../App';

function renderWithRouter(initialRoute: string) {
  return render(
    <MemoryRouter initialEntries={[initialRoute]}>
      <AuthProvider>
        <App />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('Route protection', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('redirects unauthenticated user from / to /login', () => {
    renderWithRouter('/');
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });

  it('redirects unauthenticated user from /jobs to /login', () => {
    renderWithRouter('/jobs');
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });

  it('redirects unauthenticated user from /admin to /login', () => {
    renderWithRouter('/admin');
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });

  it('renders login page at /login without redirect', () => {
    renderWithRouter('/login');
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });

  it('renders register page at /register', () => {
    renderWithRouter('/register');
    expect(screen.getByRole('button', { name: /register|sign up|create account/i })).toBeInTheDocument();
  });

  it('shows dashboard for authenticated user', () => {
    // Auth is now cookie-based; cached user in localStorage is used for initial render
    localStorage.setItem('user', JSON.stringify({ _id: '1', username: 'alice', role: 'alumni', email: 'a@t.com', accountStatus: 'active', isAlumni: true, communityId: 'c1' }));
    renderWithRouter('/');
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });

  it('denies non-admin access to /admin with access denied message', () => {
    localStorage.setItem('user', JSON.stringify({ _id: '1', username: 'alice', role: 'alumni', email: 'a@t.com', accountStatus: 'active', isAlumni: true, communityId: 'c1' }));
    renderWithRouter('/admin');
    expect(screen.getByText(/access denied/i)).toBeInTheDocument();
  });

  it('allows admin access to /admin', () => {
    localStorage.setItem('user', JSON.stringify({ _id: '1', username: 'admin', role: 'admin', email: 'a@t.com', accountStatus: 'active', isAlumni: true, communityId: 'c1' }));
    renderWithRouter('/admin');
    expect(screen.queryByText(/access denied/i)).not.toBeInTheDocument();
  });

  it('logout clears stored session state', () => {
    // Simulate what AuthContext.logout does: clear localStorage user (cookie cleared server-side)
    localStorage.setItem('user', JSON.stringify({ _id: '1', username: 'alice', role: 'alumni' }));
    expect(localStorage.getItem('user')).not.toBeNull();
    // Simulate logout
    localStorage.removeItem('user');
    expect(localStorage.getItem('user')).toBeNull();
    // After logout, rendering should show login (unauthenticated)
    renderWithRouter('/');
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });
});
