import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs.api';
import { useAuth } from '../context/AuthContext';
import { formatCents, formatDateTime } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MoneyDisplay from '../components/shared/MoneyDisplay';

export default function EscrowLedgerPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const [entries, setEntries] = useState<any[]>([]);
  const [balanceCents, setBalanceCents] = useState(0);
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ amountDollars: '', description: '' });
  const [saving, setSaving] = useState(false);

  const fetchData = async () => {
    if (!jobId) return;
    try {
      const [jobRes, escrowRes] = await Promise.all([
        jobsApi.getById(jobId),
        jobsApi.getEscrow(jobId),
      ]);
      setJob(jobRes.data);
      setEntries(escrowRes.data.entries || []);
      setBalanceCents(escrowRes.data.balanceCents ?? 0);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to load escrow data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [jobId]);

  const handleAddEscrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;

    const dollars = parseFloat(form.amountDollars);
    if (isNaN(dollars) || dollars <= 0) {
      setError('Please enter a valid positive amount');
      return;
    }
    const amountCents = Math.round(dollars * 100);

    setSaving(true);
    setError('');
    try {
      await jobsApi.addEscrow(jobId, {
        amountCents,
        description: form.description,
      });
      setShowForm(false);
      setForm({ amountDollars: '', description: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to add escrow');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading escrow ledger..." />;

  const isClient = user?._id === job?.clientId;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Escrow Ledger</h1>
          {job && <p className="text-sm text-gray-500 mt-1">Job: <Link to={`/jobs/${jobId}`} className="text-primary-600 hover:underline">{job.title}</Link></p>}
        </div>
        {isClient && (
          <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">
            {showForm ? 'Cancel' : 'Add Funds'}
          </button>
        )}
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="text-center">
          <p className="text-sm text-gray-500">Current Balance</p>
          <p className="text-3xl font-bold mt-1"><MoneyDisplay cents={balanceCents} /></p>
        </div>
      </div>

      {showForm && (
        <form onSubmit={handleAddEscrow} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input type="number" step="0.01" min="0.01" value={form.amountDollars} onChange={e => setForm({ ...form, amountDollars: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
              <input type="text" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g., Initial deposit" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add Escrow Funds'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Transactions</h2>
        </div>
        {entries.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No escrow transactions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3">Date</th>
                <th className="text-left px-6 py-3">Description</th>
                <th className="text-right px-6 py-3">Amount</th>
                <th className="text-right px-6 py-3">Running Balance</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((tx: any, i: number) => (
                <tr key={tx._id || i} className="border-b">
                  <td className="px-6 py-3">{formatDateTime(tx.createdAt)}</td>
                  <td className="px-6 py-3 text-gray-600">{tx.description || '-'}</td>
                  <td className="px-6 py-3 text-right"><MoneyDisplay cents={tx.amountCents} showSign /></td>
                  <td className="px-6 py-3 text-right font-mono">{tx.balanceCents != null ? formatCents(tx.balanceCents) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
