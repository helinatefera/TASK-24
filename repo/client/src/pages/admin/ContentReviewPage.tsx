import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin.api';
import { formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import StatusBadge from '../../components/shared/StatusBadge';
import NotesModal from '../../components/shared/NotesModal';

export default function ContentReviewPage() {
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('pending');
  const [actionLoading, setActionLoading] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    adminApi.getContentReviews(params)
      .then(res => setReviews(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load content reviews'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const handleReview = async (id: string, decision: string, reason?: string) => {
    setActionLoading(id);
    try {
      await adminApi.reviewContent(id, { decision, reason });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to review content');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Content Review Queue</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="mb-6">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">All</option>
          <option value="pending">Pending Review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading content reviews..." />
      ) : reviews.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No content to review.</div>
      ) : (
        <div className="space-y-4">
          {reviews.map(item => (
            <div key={item._id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-semibold text-sm capitalize">{item.contentType || 'Content'}</span>
                    <StatusBadge status={item.status || item.reviewStatus} />
                  </div>
                  {item.title && <p className="text-sm font-medium">{item.title}</p>}
                  {item.content && <p className="text-sm text-gray-600 mt-1 line-clamp-3">{item.content}</p>}
                  {(item.flaggedWords && item.flaggedWords.length > 0) && (
                    <div className="mt-2 flex gap-1 flex-wrap">
                      <span className="text-xs text-orange-600 mr-1">Flagged:</span>
                      {item.flaggedWords.map((w: string, i: number) => (
                        <span key={i} className="bg-red-50 text-red-700 text-xs px-2 py-0.5 rounded">{w}</span>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-400 mt-2">
                    By: <span className="font-mono">{item.submittedBy || item.userId}</span> | {formatDateTime(item.createdAt)}
                  </p>
                </div>
                {(item.status === 'pending' || item.reviewStatus === 'pending_review') && (
                  <div className="flex gap-2 ml-4">
                    <button
                      onClick={() => handleReview(item._id, 'approved')}
                      disabled={actionLoading === item._id}
                      className="bg-green-600 text-white px-3 py-1.5 rounded text-xs hover:bg-green-700 disabled:opacity-50"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => setRejectTarget(item._id)}
                      disabled={actionLoading === item._id}
                      className="bg-red-600 text-white px-3 py-1.5 rounded text-xs hover:bg-red-700 disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <NotesModal
        isOpen={!!rejectTarget}
        onClose={() => setRejectTarget(null)}
        onSubmit={(reason) => {
          if (rejectTarget) handleReview(rejectTarget, 'rejected', reason);
          setRejectTarget(null);
        }}
        title="Reject Content"
        description="Provide a reason for rejecting this content."
        placeholder="Rejection reason..."
        required
        submitLabel="Reject"
      />
    </div>
  );
}
