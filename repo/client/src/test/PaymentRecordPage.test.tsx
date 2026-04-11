import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PaymentRecordPage from '../pages/PaymentRecordPage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../api/settlements.api', () => ({
  settlementsApi: { recordPayment: vi.fn() },
}));
import { settlementsApi } from '../api/settlements.api';

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/settlements/s123/pay']}>
      <Routes>
        <Route path="/settlements/:id/pay" element={<PaymentRecordPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

function field(label: string) { return screen.getByText(label).parentElement!.querySelector('input, select, textarea')!; }

describe('PaymentRecordPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders form with amount, method, date, and submit', () => {
    renderPage();
    expect(screen.getByText('Amount ($) *')).toBeInTheDocument();
    expect(screen.getByText('Payment Method *')).toBeInTheDocument();
    expect(screen.getByText('Payment Date *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /record payment/i })).toBeInTheDocument();
  });

  it('converts dollars to cents and submits', async () => {
    (settlementsApi.recordPayment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} });
    renderPage();

    fireEvent.change(field('Amount ($) *'), { target: { value: '150.75' } });
    fireEvent.click(screen.getByRole('button', { name: /record payment/i }));

    await waitFor(() => {
      expect(settlementsApi.recordPayment).toHaveBeenCalledWith('s123', expect.objectContaining({
        amountCents: 15075,
        method: 'bank_transfer',
      }));
    });
  });

  it('does not submit with empty amount', () => {
    renderPage();
    // Amount field has min="0.01" and required — HTML5 validation blocks submission
    fireEvent.click(screen.getByRole('button', { name: /record payment/i }));
    expect(settlementsApi.recordPayment).not.toHaveBeenCalled();
  });

  it('shows server error on failure', async () => {
    (settlementsApi.recordPayment as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { msg: 'Settlement not approved' } },
    });
    renderPage();

    fireEvent.change(field('Amount ($) *'), { target: { value: '100' } });
    fireEvent.click(screen.getByRole('button', { name: /record payment/i }));

    await waitFor(() => {
      expect(screen.getByText('Settlement not approved')).toBeInTheDocument();
    });
  });

  it('shows success message on successful payment', async () => {
    (settlementsApi.recordPayment as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: {} });
    renderPage();

    fireEvent.change(field('Amount ($) *'), { target: { value: '50' } });
    fireEvent.click(screen.getByRole('button', { name: /record payment/i }));

    await waitFor(() => {
      expect(screen.getByText(/payment recorded successfully/i)).toBeInTheDocument();
    });
  });

  it('allows selecting different payment methods', () => {
    renderPage();
    const select = field('Payment Method *') as HTMLSelectElement;
    expect(select.value).toBe('bank_transfer');
    fireEvent.change(select, { target: { value: 'cash' } });
    expect(select.value).toBe('cash');
  });

  it('displays settlement ID', () => {
    renderPage();
    expect(screen.getByText('s123')).toBeInTheDocument();
  });
});
