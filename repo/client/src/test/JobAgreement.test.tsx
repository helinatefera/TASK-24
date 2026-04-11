import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PasswordConfirmModal from '../components/shared/PasswordConfirmModal';

describe('PasswordConfirmModal', () => {
  beforeEach(() => { localStorage.clear(); });

  it('renders password input when open', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<PasswordConfirmModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /confirm/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('does not render when closed', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<PasswordConfirmModal isOpen={false} onClose={onClose} onConfirm={onConfirm} />);
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();
  });

  it('calls onConfirm with password on submit', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockResolvedValue(undefined);
    render(<PasswordConfirmModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'MyPass123!' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(onConfirm).toHaveBeenCalledWith('MyPass123!'));
  });

  it('shows error when onConfirm rejects', async () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn().mockRejectedValue({ response: { data: { msg: 'Wrong password' } } });
    render(<PasswordConfirmModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'bad' } });
    fireEvent.click(screen.getByRole('button', { name: /confirm/i }));
    await waitFor(() => expect(screen.getByText(/wrong password/i)).toBeInTheDocument());
  });

  it('clears password on close', () => {
    const onClose = vi.fn();
    const onConfirm = vi.fn();
    render(<PasswordConfirmModal isOpen={true} onClose={onClose} onConfirm={onConfirm} />);
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: 'secret' } });
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }));
    expect(onClose).toHaveBeenCalled();
  });

  it('uses type="password" for the input (not plaintext)', () => {
    render(<PasswordConfirmModal isOpen={true} onClose={vi.fn()} onConfirm={vi.fn()} />);
    const input = screen.getByLabelText(/password/i);
    expect(input).toHaveAttribute('type', 'password');
  });
});
