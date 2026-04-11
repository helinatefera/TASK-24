import { useState } from 'react';
import Modal from './Modal';

interface PasswordConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (password: string) => Promise<void>;
  title?: string;
  description?: string;
}

export default function PasswordConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'Confirm Agreement',
  description = 'Enter your password to confirm this agreement.',
}: PasswordConfirmModalProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password) {
      setError('Password is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      await onConfirm(password);
      setPassword('');
      setError('');
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.msg || err.message || 'Confirmation failed');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setPassword('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-gray-600">{description}</p>
        {error && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{error}</div>}
        <div>
          <label htmlFor="confirm-password" className="block text-sm font-medium text-gray-700 mb-1">
            Password
          </label>
          <input
            id="confirm-password"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            autoFocus
            autoComplete="current-password"
            required
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Enter your password"
          />
        </div>
        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={handleClose}
            className="border px-4 py-2 rounded text-sm hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading || !password}
            className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? 'Confirming...' : 'Confirm'}
          </button>
        </div>
      </form>
    </Modal>
  );
}
