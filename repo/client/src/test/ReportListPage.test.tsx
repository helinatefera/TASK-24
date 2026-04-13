import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReportListPage from '../pages/ReportListPage';

vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: { _id: '1', username: 'alice', role: 'alumni' }, isAuthenticated: true }),
}));

vi.mock('../api/reports.api', () => ({
  reportsApi: {
    getMyReports: vi.fn().mockResolvedValue({ data: [] }),
  },
}));

function renderPage() {
  return render(
    <MemoryRouter>
      <ReportListPage />
    </MemoryRouter>,
  );
}

describe('ReportListPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders "New Report" link pointing to /reports/new', async () => {
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /new report/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute('href', '/reports/new');
    });
  });

  it('shows empty state when no reports exist', async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/you have not submitted any reports/i)).toBeInTheDocument();
    });
  });

  it('"New Report" link matches a defined route (not /reports/create)', async () => {
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole('link', { name: /new report/i });
      // The route is /reports/new in App.tsx — verify the link does NOT point to the old broken path
      expect(link.getAttribute('href')).not.toBe('/reports/create');
    });
  });
});
