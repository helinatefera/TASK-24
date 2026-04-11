import { useState } from 'react';
import Modal from './Modal';

interface NotesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (notes: string) => void;
  title?: string;
  description?: string;
  placeholder?: string;
  required?: boolean;
  submitLabel?: string;
}

export default function NotesModal({
  isOpen,
  onClose,
  onSubmit,
  title = 'Add Notes',
  description,
  placeholder = 'Enter notes...',
  required = false,
  submitLabel = 'Submit',
}: NotesModalProps) {
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (required && !notes.trim()) {
      setError('Notes are required');
      return;
    }
    onSubmit(notes);
    setNotes('');
    setError('');
    onClose();
  };

  const handleClose = () => {
    setNotes('');
    setError('');
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title={title} size="sm">
      <form onSubmit={handleSubmit} className="space-y-4">
        {description && <p className="text-sm text-gray-600">{description}</p>}
        {error && <div className="bg-red-50 text-red-600 p-2 rounded text-sm">{error}</div>}
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          autoFocus
          rows={3}
          className="w-full border rounded px-3 py-2 text-sm"
          placeholder={placeholder}
        />
        <div className="flex justify-end gap-2">
          <button type="button" onClick={handleClose} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
            Cancel
          </button>
          <button type="submit" className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
            {submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  );
}
