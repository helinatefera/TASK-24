import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import App from '../App';

function renderAuthenticated(route: string, role = 'alumni') {

  localStorage.setItem('user', JSON.stringify({
    _id: '1', username: 'testuser', role, email: 'test@t.com',
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

describe('ConsentManagementPage routing', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders consent page at /consent for authenticated user', () => {
    renderAuthenticated('/consent');
    // Should not redirect to login
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user from /consent to login', () => {
    render(
      <MemoryRouter initialEntries={['/consent']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });

  it('renders consent history page at /consent/history for authenticated user', () => {
    renderAuthenticated('/consent/history');
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });
});

describe('PortfolioPage routing', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders portfolio list at /portfolios for authenticated user', () => {
    renderAuthenticated('/portfolios');
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });

  it('renders portfolio detail at /portfolios/:id for authenticated user', () => {
    renderAuthenticated('/portfolios/abc123');
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });

  it('renders portfolio upload at /portfolios/:id/upload for authenticated user', () => {
    renderAuthenticated('/portfolios/abc123/upload', 'photographer');
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });

  it('renders portfolio upload at /portfolio/upload for authenticated user', () => {
    renderAuthenticated('/portfolio/upload', 'photographer');
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user from /portfolios to login', () => {
    render(
      <MemoryRouter initialEntries={['/portfolios']}>
        <AuthProvider>
          <App />
        </AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });
});
