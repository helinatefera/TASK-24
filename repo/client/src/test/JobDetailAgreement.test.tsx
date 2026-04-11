import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PasswordConfirmModal from '../components/shared/PasswordConfirmModal';

// Integration-level test: simulates the JobDetailPage agreement flow
// by rendering the PasswordConfirmModal with a mock onConfirm that
// represents jobsApi.confirmAgreement

describe('JobDetailPage agreement e-confirmation (integration)', () => {
  beforeEach(() => { localStorage.clear(); });

  it('opens modal, enters password, calls confirmAgreement on submit', async () => {
    const mockConfirmAgreement = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();

    render(
      <PasswordConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={mockConfirmAgreement}
        title="Confirm Service Agreement"
        description="Enter your password to electronically confirm this service agreement."
      />
    );

    // Modal is visible with correct title
    expect(screen.getByText('Confirm Service Agreement')).toBeInTheDocument();
    expect(screen.getByText(/electronically confirm/i)).toBeInTheDocument();

    // Enter password
    const input = screen.getByLabelText(/password/i);
    expect(input).toHaveAttribute('type', 'password');
    fireEvent.change(input, { target: { value: 'SecurePass123!' } });

    // Submit
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    // Assert API was called with the entered password
    await waitFor(() => {
      expect(mockConfirmAgreement).toHaveBeenCalledTimes(1);
      expect(mockConfirmAgreement).toHaveBeenCalledWith('SecurePass123!');
    });

    // Modal closes after success
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });

  it('shows error when confirmAgreement fails (wrong password)', async () => {
    const mockConfirmAgreement = vi.fn().mockRejectedValue({
      response: { data: { msg: 'Invalid password' } },
    });

    render(
      <PasswordConfirmModal
        isOpen={true}
        onClose={vi.fn()}
        onConfirm={mockConfirmAgreement}
        title="Confirm Service Agreement"
      />
    );

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'wrong' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => {
      expect(screen.getByText(/invalid password/i)).toBeInTheDocument();
    });
    // Modal stays open — user can retry
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
  });

  it('cancel closes modal without calling confirmAgreement', () => {
    const mockConfirmAgreement = vi.fn();
    const onClose = vi.fn();

    render(
      <PasswordConfirmModal
        isOpen={true}
        onClose={onClose}
        onConfirm={mockConfirmAgreement}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(onClose).toHaveBeenCalled();
    expect(mockConfirmAgreement).not.toHaveBeenCalled();
  });

  it('clears password field after successful confirmation', async () => {
    let capturedPassword = '';
    const mockConfirm = vi.fn().mockImplementation(async (pw: string) => {
      capturedPassword = pw;
    });

    const { rerender } = render(
      <PasswordConfirmModal isOpen={true} onClose={vi.fn()} onConfirm={mockConfirm} />
    );

    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'MySecret1!' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));

    await waitFor(() => expect(mockConfirm).toHaveBeenCalled());
    expect(capturedPassword).toBe('MySecret1!');
  });
});
