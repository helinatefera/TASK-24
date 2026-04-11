import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin.api';
import { formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import StatusBadge from '../../components/shared/StatusBadge';

export default function VerificationReviewPage() {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [rejectingId, setRejectingId] = useState('');

  const fetchData = () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    adminApi.getVerificationRequests(params)
      .then(res => setRequests(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load verification requests'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const handleApprove = async (id: string) => {
    setActionLoading(id);
    try {
      await adminApi.reviewVerification(id, { decision: 'approved' });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to approve');
    } finally {
      setActionLoading('');
    }
  };

  const handleReject = async (id: string) => {
    if (!rejectionReason.trim()) { setError('Please provide a rejection reason.'); return; }
    setActionLoading(id);
    try {
      await adminApi.reviewVerification(id, { decision: 'rejected', rejectionReason });
      setRejectingId('');
      setRejectionReason('');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to reject');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Verification Review</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="mb-6">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">All</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading requests..." />
      ) : requests.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No verification requests found.</div>
      ) : (
        <div className="space-y-4">
          {requests.map(req => (
            <div key={req._id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-sm">User: <span className="font-mono text-xs">{req.userId || req.username}</span></span>
                    <StatusBadge status={req.status} />
                  </div>
                  <p className="text-sm text-gray-600">Document Type: <span className="capitalize">{req.documentType?.replace(/_/g, ' ') || 'N/A'}</span></p>
                  {req.notes && <p className="text-sm text-gray-500 mt-1">Notes: {req.notes}</p>}
                  <p className="text-xs text-gray-400 mt-2">Submitted: {formatDateTime(req.submittedAt || req.createdAt)}</p>
                  {req.documents && (
                    <div className="mt-2 flex gap-2">
                      {(Array.isArray(req.documents) ? req.documents : []).map((doc: any, i: number) => (
                        <a key={i} href={doc.url || doc} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:underline text-xs">
                          Document {i + 1}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
                {req.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApprove(req._id)}
                      disabled={actionLoading === req._id}
                      className="bg-green-600 text-white px-3 py-1.5 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectingId(rejectingId === req._id ? '' : req._id)}
                      disabled={actionLoading === req._id}
                      className="bg-red-600 text-white px-3 py-1.5 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
              {rejectingId === req._id && (
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    placeholder="Rejection reason..."
                    value={rejectionReason}
                    onChange={e => setRejectionReason(e.target.value)}
                    className="flex-1 border rounded px-3 py-2 text-sm"
                  />
                  <button
                    onClick={() => handleReject(req._id)}
                    disabled={actionLoading === req._id}
                    className="bg-red-600 text-white px-3 py-1.5 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                  >
                    Confirm Reject
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
