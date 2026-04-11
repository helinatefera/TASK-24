import { useEffect, useState } from 'react';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { formatDateTime } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';

type Tab = 'incoming' | 'outgoing';

export default function AccessRequestsPage() {
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>('incoming');
  const [incoming, setIncoming] = useState<any[]>([]);
  const [outgoing, setOutgoing] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const [incRes, outRes] = await Promise.all([
        apiClient.get('/access-requests/incoming'),
        apiClient.get('/access-requests/outgoing'),
      ]);
      setIncoming(incRes.data.items || incRes.data || []);
      setOutgoing(outRes.data.items || outRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to load access requests');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleAction = async (requestId: string, action: 'approve' | 'deny') => {
    setActionLoading(requestId);
    try {
      await apiClient.patch(`/access-requests/${requestId}/${action}`);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || `Failed to ${action} request`);
    } finally {
      setActionLoading('');
    }
  };

  // New request form state
  const [showForm, setShowForm] = useState(false);
  const [reqForm, setReqForm] = useState({ targetUserId: '', fields: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleCreateRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError('');
    try {
      await apiClient.post('/access-requests', {
        targetUserId: reqForm.targetUserId,
        fields: reqForm.fields.split(',').map(f => f.trim()).filter(Boolean),
        reason: reqForm.reason,
      });
      setReqForm({ targetUserId: '', fields: '', reason: '' });
      setShowForm(false);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to create request');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading access requests..." />;

  const items = tab === 'incoming' ? incoming : outgoing;

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Access Requests</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">
          {showForm ? 'Cancel' : 'New Request'}
        </button>
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreateRequest} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target User ID</label>
            <input type="text" value={reqForm.targetUserId} onChange={e => setReqForm({ ...reqForm, targetUserId: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Fields (comma-separated)</label>
            <input type="text" value={reqForm.fields} onChange={e => setReqForm({ ...reqForm, fields: e.target.value })} placeholder="email, phone, location" required className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
            <textarea value={reqForm.reason} onChange={e => setReqForm({ ...reqForm, reason: e.target.value })} required rows={2} className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={submitting} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 disabled:opacity-50">
            {submitting ? 'Submitting...' : 'Submit Request'}
          </button>
        </form>
      )}

      <div className="flex gap-1 mb-4">
        {(['incoming', 'outgoing'] as Tab[]).map(t => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2 rounded-t text-sm font-medium ${tab === t ? 'bg-white border border-b-0 text-primary-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {t === 'incoming' ? 'Incoming' : 'Outgoing'} ({t === 'incoming' ? incoming.length : outgoing.length})
          </button>
        ))}
      </div>

      <div className="bg-white rounded-lg shadow">
        {items.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No {tab} requests.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3">{tab === 'incoming' ? 'From' : 'To'}</th>
                <th className="text-left px-6 py-3">Fields</th>
                <th className="text-left px-6 py-3">Reason</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Date</th>
                {tab === 'incoming' && <th className="text-left px-6 py-3">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {items.map((req: any) => (
                <tr key={req._id} className="border-b">
                  <td className="px-6 py-3 font-mono text-xs">{tab === 'incoming' ? req.requesterId : req.targetUserId}</td>
                  <td className="px-6 py-3">{(req.fields || []).join(', ')}</td>
                  <td className="px-6 py-3 text-gray-600 max-w-xs truncate">{req.reason}</td>
                  <td className="px-6 py-3"><StatusBadge status={req.status} /></td>
                  <td className="px-6 py-3">{formatDateTime(req.createdAt || req.expiresAt)}</td>
                  {tab === 'incoming' && (
                    <td className="px-6 py-3">
                      {req.status === 'pending' && (
                        <div className="flex gap-2">
                          <button onClick={() => handleAction(req._id, 'approve')} disabled={actionLoading === req._id} className="text-green-600 hover:underline text-xs disabled:opacity-50">Approve</button>
                          <button onClick={() => handleAction(req._id, 'deny')} disabled={actionLoading === req._id} className="text-red-600 hover:underline text-xs disabled:opacity-50">Deny</button>
                        </div>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
