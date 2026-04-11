import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { settlementsApi } from '../api/settlements.api';

export default function PaymentRecordPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    amountDollars: '',
    method: 'bank_transfer',
    reference: '',
    notes: '',
    paidAt: new Date().toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;

    const dollars = parseFloat(form.amountDollars);
    if (isNaN(dollars) || dollars <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    const amountCents = Math.round(dollars * 100);

    setLoading(true);
    setError('');
    setSuccess('');
    try {
      await settlementsApi.recordPayment(id, {
        amountCents,
        method: form.method,
        reference: form.reference,
        notes: form.notes,
        paidAt: form.paidAt,
      });
      setSuccess('Payment recorded successfully.');
      setTimeout(() => navigate(`/settlements/${id}`), 1500);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to record payment');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Record Payment</h1>
      <p className="text-sm text-gray-500 mb-4">Settlement ID: <span className="font-mono">{id}</span></p>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($) *</label>
          <input type="number" step="0.01" min="0.01" value={form.amountDollars} onChange={e => setForm({ ...form, amountDollars: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" placeholder="0.00" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method *</label>
          <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
            <option value="bank_transfer">Bank Transfer</option>
            <option value="check">Check</option>
            <option value="cash">Cash</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Payment Date *</label>
          <input type="date" value={form.paidAt} onChange={e => setForm({ ...form, paidAt: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reference / Transaction ID</label>
          <input type="text" value={form.reference} onChange={e => setForm({ ...form, reference: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="Optional reference number" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
          <textarea value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} rows={2} className="w-full border rounded px-3 py-2 text-sm" placeholder="Additional notes..." />
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700 disabled:opacity-50 text-sm">
            {loading ? 'Recording...' : 'Record Payment'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="border px-6 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}
