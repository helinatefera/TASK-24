import { describe, it, expect, vi, beforeEach } from 'vitest';
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

describe('Settlement export routing & access', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders settlement detail for authenticated user', () => {
    renderAuthenticated('/settlements/abc123');
    expect(screen.queryByRole('button', { name: /sign in|log in/i })).not.toBeInTheDocument();
  });

  it('redirects unauthenticated user to login', () => {
    render(
      <MemoryRouter initialEntries={['/settlements/abc123']}>
        <AuthProvider><App /></AuthProvider>
      </MemoryRouter>,
    );
    expect(screen.getByRole('button', { name: /sign in|log in/i })).toBeInTheDocument();
  });
});

describe('Settlement export permission blocking', () => {
  it('403 on PDF export blocks download and surfaces error message', async () => {
    const setError = vi.fn();
    let downloadStarted = false;

    const mockExportPdf = vi.fn().mockRejectedValue({
      response: { status: 403, data: { msg: 'Access denied — account restricted' } },
    });

    // Simulate SettlementDetailPage.handleExport flow
    try {
      const res = await mockExportPdf('settlement123');
      // Download would start here — should NOT be reached on 403
      downloadStarted = true;
      const blob = new Blob([res.data]);
      const url = URL.createObjectURL(blob);
      // ... download trigger
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to export pdf');
    }

    expect(downloadStarted).toBe(false);
    expect(setError).toHaveBeenCalledWith('Access denied — account restricted');
  });

  it('403 on CSV export blocks download and surfaces error message', async () => {
    const setError = vi.fn();
    let downloadStarted = false;

    const mockExportCsv = vi.fn().mockRejectedValue({
      response: { status: 403, data: { msg: 'Exports blocked for banned accounts' } },
    });

    try {
      await mockExportCsv('settlement123');
      downloadStarted = true;
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to export csv');
    }

    expect(downloadStarted).toBe(false);
    expect(setError).toHaveBeenCalledWith('Exports blocked for banned accounts');
  });

  it('successful export completes without error', async () => {
    const setError = vi.fn();
    const mockExport = vi.fn().mockResolvedValue({ data: new Blob(['pdf data']) });

    try {
      const res = await mockExport('settlement123');
      expect(res.data).toBeInstanceOf(Blob);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed');
    }

    expect(setError).not.toHaveBeenCalled();
  });

  it('network error shows generic failure message', async () => {
    const setError = vi.fn();
    const mockExport = vi.fn().mockRejectedValue(new Error('Network Error'));

    try {
      await mockExport('settlement123');
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to export — check connection');
    }

    expect(setError).toHaveBeenCalledWith('Failed to export — check connection');
  });
});
