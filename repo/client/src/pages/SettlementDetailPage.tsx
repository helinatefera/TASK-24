import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { settlementsApi } from '../api/settlements.api';
import { useAuth } from '../context/AuthContext';
import { formatCents, formatDateTime } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';
import MoneyDisplay from '../components/shared/MoneyDisplay';

export default function SettlementDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [settlement, setSettlement] = useState<any>(null);
  const [lineItems, setLineItems] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAdjForm, setShowAdjForm] = useState(false);
  const [adjForm, setAdjForm] = useState({ amountCents: '', reason: '' });
  const [adjSaving, setAdjSaving] = useState(false);

  const fetchData = async () => {
    if (!id) return;
    try {
      const [sRes, pRes] = await Promise.all([
        settlementsApi.getById(id),
        settlementsApi.getPayments(id).catch(() => ({ data: [] })),
      ]);
      const sData = sRes.data.settlement || sRes.data;
      setSettlement(sData);
      setLineItems(sRes.data.lineItems || []);
      setPayments(pRes.data.items || pRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to load settlement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [id]);

  const handleApprove = async () => {
    if (!id) return;
    try {
      await settlementsApi.approve(id);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to approve');
    }
  };

  const handleAddAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id) return;
    setAdjSaving(true);
    try {
      await settlementsApi.addAdjustment(id, {
        amountCents: Math.round(parseFloat(adjForm.amountCents) * 100),
        reason: adjForm.reason,
      });
      setShowAdjForm(false);
      setAdjForm({ amountCents: '', reason: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to add adjustment');
    } finally {
      setAdjSaving(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'csv') => {
    if (!id) return;
    try {
      const res = format === 'pdf' ? await settlementsApi.exportPdf(id) : await settlementsApi.exportCsv(id);
      const blob = new Blob([res.data], { type: format === 'pdf' ? 'application/pdf' : 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `settlement-${id}.${format}`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setError(err.response?.data?.msg || `Failed to export ${format}`);
    }
  };

  if (loading) return <LoadingSpinner message="Loading settlement..." />;
  if (!settlement) return <div className="text-gray-500">Settlement not found.</div>;

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Settlement Details</h1>
          <p className="text-sm text-gray-500 mt-1">
            Job: <Link to={`/jobs/${settlement.jobId}`} className="text-primary-600 hover:underline">{settlement.jobId}</Link>
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => handleExport('pdf')} className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50">Export PDF</button>
          <button onClick={() => handleExport('csv')} className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50">Export CSV</button>
        </div>
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="font-semibold">Summary</h2>
          <StatusBadge status={settlement.status} size="md" />
        </div>
        <dl className="divide-y">
          <div className="px-6 py-3 flex justify-between">
            <dt className="text-sm text-gray-500">Subtotal</dt>
            <dd><MoneyDisplay cents={settlement.subtotalCents || 0} /></dd>
          </div>
          <div className="px-6 py-3 flex justify-between">
            <dt className="text-sm text-gray-500">Adjustments</dt>
            <dd><MoneyDisplay cents={settlement.adjustmentCents || 0} showSign /></dd>
          </div>
          <div className="px-6 py-3 flex justify-between font-semibold">
            <dt className="text-sm">Final Amount</dt>
            <dd><MoneyDisplay cents={settlement.finalAmountCents || 0} /></dd>
          </div>
          {settlement.varianceReason && (
            <div className="px-6 py-3">
              <dt className="text-sm text-gray-500 mb-1">Variance Reason</dt>
              <dd className="text-sm">{settlement.varianceReason}</dd>
            </div>
          )}
          <div className="px-6 py-3 flex justify-between text-sm">
            <span>Photographer Approved: <strong className={settlement.photographerApproved ? 'text-green-600' : 'text-gray-400'}>{settlement.photographerApproved ? 'Yes' : 'No'}</strong></span>
            <span>Client Approved: <strong className={settlement.clientApproved ? 'text-green-600' : 'text-gray-400'}>{settlement.clientApproved ? 'Yes' : 'No'}</strong></span>
          </div>
        </dl>
        <div className="px-6 py-4 border-t flex gap-2">
          <button onClick={handleApprove} className="bg-green-600 text-white px-4 py-2 rounded text-sm hover:bg-green-700">
            Approve Settlement
          </button>
          <button onClick={() => setShowAdjForm(!showAdjForm)} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
            {showAdjForm ? 'Cancel' : 'Add Adjustment'}
          </button>
          <Link to={`/settlements/${id}/pay`} className="border px-4 py-2 rounded text-sm hover:bg-gray-50">
            Record Payment
          </Link>
        </div>
      </div>

      {showAdjForm && (
        <form onSubmit={handleAddAdjustment} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <h3 className="font-semibold text-sm">Add Adjustment</h3>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Amount ($)</label>
              <input type="number" step="0.01" value={adjForm.amountCents} onChange={e => setAdjForm({ ...adjForm, amountCents: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" placeholder="Use negative for deductions" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input type="text" value={adjForm.reason} onChange={e => setAdjForm({ ...adjForm, reason: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={adjSaving} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 disabled:opacity-50">
            {adjSaving ? 'Adding...' : 'Add Adjustment'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Payments</h2>
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No payments recorded yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50"><th className="text-left px-6 py-3">Date</th><th className="text-left px-6 py-3">Method</th><th className="text-right px-6 py-3">Amount</th><th className="text-left px-6 py-3">Reference</th></tr></thead>
            <tbody>
              {payments.map((p: any, i: number) => (
                <tr key={p._id || i} className="border-b">
                  <td className="px-6 py-3">{formatDateTime(p.paidAt || p.createdAt)}</td>
                  <td className="px-6 py-3 capitalize">{p.method || p.paymentMethod || '-'}</td>
                  <td className="px-6 py-3 text-right"><MoneyDisplay cents={p.amountCents || 0} /></td>
                  <td className="px-6 py-3 text-gray-600">{p.reference || p.transactionRef || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
