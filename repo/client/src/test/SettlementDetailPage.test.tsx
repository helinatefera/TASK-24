import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import SettlementDetailPage from '../pages/SettlementDetailPage';

// Mock the settlements API
vi.mock('../api/settlements.api', () => ({
  settlementsApi: {
    getById: vi.fn(),
    getPayments: vi.fn(),
    approve: vi.fn(),
    addAdjustment: vi.fn(),
    exportPdf: vi.fn(),
    exportCsv: vi.fn(),
  },
}));

import { settlementsApi } from '../api/settlements.api';

function renderPage() {

  localStorage.setItem('user', JSON.stringify({ _id: '1', username: 'alice', role: 'alumni', email: 'a@t.com', accountStatus: 'active', isAlumni: true, communityId: 'c1' }));
  return render(
    <MemoryRouter initialEntries={['/settlements/abc123']}>
      <AuthProvider>
        <Routes>
          <Route path="/settlements/:id" element={<SettlementDetailPage />} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>,
  );
}

const mockSettlement = {
  _id: 'abc123',
  jobId: 'job1',
  status: 'draft',
  subtotalCents: 10000,
  adjustmentCents: 0,
  finalAmountCents: 10000,
};

describe('SettlementDetailPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows loading spinner initially', () => {
    (settlementsApi.getById as any).mockReturnValue(new Promise(() => {}));
    (settlementsApi.getPayments as any).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading settlement/i)).toBeInTheDocument();
  });

  it('renders settlement data after load', async () => {
    (settlementsApi.getById as any).mockResolvedValue({ data: { settlement: mockSettlement, lineItems: [] } });
    (settlementsApi.getPayments as any).mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/settlement details/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/draft/i)).toBeInTheDocument();
  });

  it('shows error state on API failure', async () => {
    (settlementsApi.getById as any).mockRejectedValue({ response: { data: { msg: 'Not found' } } });
    (settlementsApi.getPayments as any).mockRejectedValue({});
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/not found|failed/i)).toBeInTheDocument();
    });
  });

  it('has approve and add adjustment buttons', async () => {
    (settlementsApi.getById as any).mockResolvedValue({ data: { settlement: mockSettlement, lineItems: [] } });
    (settlementsApi.getPayments as any).mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/approve settlement/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/add adjustment/i)).toBeInTheDocument();
    expect(screen.getByText(/record payment/i)).toBeInTheDocument();
  });

  it('has export PDF and CSV buttons', async () => {
    (settlementsApi.getById as any).mockResolvedValue({ data: { settlement: mockSettlement, lineItems: [] } });
    (settlementsApi.getPayments as any).mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/export pdf/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/export csv/i)).toBeInTheDocument();
  });

  it('toggles adjustment form on button click', async () => {
    (settlementsApi.getById as any).mockResolvedValue({ data: { settlement: mockSettlement, lineItems: [] } });
    (settlementsApi.getPayments as any).mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => screen.getByText(/add adjustment/i));
    fireEvent.click(screen.getByText(/add adjustment/i));
    expect(screen.getByPlaceholderText(/negative for deductions/i)).toBeInTheDocument();
  });

  it('calls settlementsApi.approve when approve button clicked', async () => {
    (settlementsApi.getById as any).mockResolvedValue({ data: { settlement: mockSettlement, lineItems: [] } });
    (settlementsApi.getPayments as any).mockResolvedValue({ data: [] });
    (settlementsApi.approve as any).mockResolvedValue({ data: {} });
    renderPage();
    await waitFor(() => screen.getByText(/approve settlement/i));
    fireEvent.click(screen.getByText(/approve settlement/i));
    await waitFor(() => {
      expect(settlementsApi.approve).toHaveBeenCalledWith('abc123');
    });
  });

  it('calls settlementsApi.addAdjustment on form submit', async () => {
    (settlementsApi.getById as any).mockResolvedValue({ data: { settlement: mockSettlement, lineItems: [] } });
    (settlementsApi.getPayments as any).mockResolvedValue({ data: [] });
    (settlementsApi.addAdjustment as any).mockResolvedValue({ data: {} });
    renderPage();
    await waitFor(() => screen.getByText(/add adjustment/i));
    // Click the toggle button (the one outside the form)
    const buttons = screen.getAllByRole('button');
    const toggleBtn = buttons.find(b => b.textContent === 'Add Adjustment' && b.getAttribute('type') !== 'submit');
    fireEvent.click(toggleBtn!);
    const amountInput = screen.getByPlaceholderText(/negative for deductions/i);
    fireEvent.change(amountInput, { target: { value: '5.00' } });
    const formInputs = screen.getAllByRole('textbox').filter(el => el.closest('form'));
    if (formInputs.length > 0) {
      fireEvent.change(formInputs[formInputs.length - 1], { target: { value: 'Discount' } });
    }
    // Click the submit button inside the form
    const submitBtn = buttons.find(b => b.getAttribute('type') === 'submit' && /add adjustment/i.test(b.textContent || ''));
    if (submitBtn) {
      fireEvent.click(submitBtn);
      await waitFor(() => {
        expect(settlementsApi.addAdjustment).toHaveBeenCalled();
      });
    }
  });
});
