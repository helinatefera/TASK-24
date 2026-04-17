import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import VerificationPage from '../pages/VerificationPage';

vi.mock('../api/verification.api', () => ({
  verificationApi: {
    getStatus: vi.fn(),
    submit: vi.fn(),
  },
}));
import { verificationApi } from '../api/verification.api';

function renderPage() {
  return render(<MemoryRouter><VerificationPage /></MemoryRouter>);
}

describe('VerificationPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('shows current verification status', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { status: 'verified', submittedAt: '2026-01-01T00:00:00Z' },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/verified/i)).toBeInTheDocument();
    });
  });

  it('hides submission form when already verified', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { status: 'verified' },
    });
    renderPage();
    await waitFor(() => screen.getByText(/verified/i));
    expect(screen.queryByText(/submit verification documents/i)).not.toBeInTheDocument();
  });

  it('shows submission form when not verified', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { status: 'submitted', submittedAt: '2026-01-01' },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/submit verification documents/i)).toBeInTheDocument();
    });
  });

  it('shows submission form when no status exists', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/submit verification documents/i)).toBeInTheDocument();
    });
  });

  it('shows rejection reason when status is rejected', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      data: { status: 'rejected', rejectionReason: 'Documents unclear' },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/documents unclear/i)).toBeInTheDocument();
    });
  });

  it('disables submit button when no files selected', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText(/submit verification documents/i));

    expect(screen.getByRole('button', { name: /submit for verification/i })).toBeDisabled();
  });

  it('shows success message after successful submission', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>)
      .mockRejectedValueOnce({})
      .mockResolvedValueOnce({ data: { status: 'submitted' } });
    (verificationApi.submit as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});

    renderPage();
    await waitFor(() => screen.getByText(/submit verification documents/i));

    // Fill required identity fields
    const realNameInput = screen.getByPlaceholderText(/legal name as shown on id/i);
    fireEvent.change(realNameInput, { target: { value: 'Jane Doe' } });

    // Select a file
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'id.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    fireEvent.click(screen.getByRole('button', { name: /submit for verification/i }));

    await waitFor(() => {
      expect(screen.getByText(/submitted successfully/i)).toBeInTheDocument();
    });

    // Verify FormData contract: realName and qualificationType MUST be sent
    const formDataArg = (verificationApi.submit as ReturnType<typeof vi.fn>).mock.calls[0][0];
    expect(formDataArg).toBeInstanceOf(FormData);
    expect(formDataArg.get('realName')).toBe('Jane Doe');
    expect(formDataArg.get('qualificationType')).toBeDefined();
  });

  it('blocks submit when realName is empty', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText(/submit verification documents/i));

    // Select a file but leave realName blank
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'id.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    // Button should still be disabled because realName is empty
    expect(screen.getByRole('button', { name: /submit for verification/i })).toBeDisabled();
  });

  it('has realName input and qualificationType select required by backend', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText(/submit verification documents/i));

    expect(screen.getByText('Legal Name', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Qualification Type', { exact: false })).toBeInTheDocument();

    // Qualification type select has the backend-required enum options
    const qualSelect = screen.getByText('Qualification Type', { exact: false }).parentElement!.querySelector('select') as HTMLSelectElement;
    const options = Array.from(qualSelect.options).map(o => o.value);
    expect(options).toEqual(expect.arrayContaining(['general', 'photography', 'videography', 'event', 'portrait', 'commercial']));
  });

  it('shows server error on submission failure', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    (verificationApi.submit as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { msg: 'Invalid document format' } },
    });

    renderPage();
    await waitFor(() => screen.getByText(/submit verification documents/i));

    // Fill required identity fields
    fireEvent.change(screen.getByPlaceholderText(/legal name as shown on id/i), { target: { value: 'Test User' } });

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file], configurable: true });
    fireEvent.change(input);

    fireEvent.click(screen.getByRole('button', { name: /submit for verification/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid document format')).toBeInTheDocument();
    });
  });

  it('has document type selector with expected options', async () => {
    (verificationApi.getStatus as ReturnType<typeof vi.fn>).mockRejectedValueOnce({});
    renderPage();
    await waitFor(() => screen.getByText(/submit verification documents/i));

    const select = screen.getByText('Document Type').parentElement!.querySelector('select') as HTMLSelectElement;
    expect(select.value).toBe('government_id');

    const options = Array.from(select.options).map(o => o.value);
    expect(options).toContain('government_id');
    expect(options).toContain('passport');
    expect(options).toContain('alumni_certificate');
    expect(options).toContain('drivers_license');
  });
});
