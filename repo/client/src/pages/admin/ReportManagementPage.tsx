import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin.api';
import { formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import StatusBadge from '../../components/shared/StatusBadge';
import NotesModal from '../../components/shared/NotesModal';

const STATUS_TRANSITIONS: Record<string, string[]> = {
  submitted: ['under_review'],
  under_review: ['needs_more_info', 'action_taken', 'rejected'],
  needs_more_info: ['under_review', 'closed'],
  action_taken: ['closed'],
  rejected: ['closed'],
  closed: [],
};

export default function ReportManagementPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [actionLoading, setActionLoading] = useState('');
  const [transitionTarget, setTransitionTarget] = useState<{ id: string; status: string } | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params: any = {};
    if (statusFilter) params.status = statusFilter;
    adminApi.getReports(params)
      .then(res => setReports(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load reports'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, [statusFilter]);

  const handleTransition = async (id: string, newStatus: string, notes: string) => {
    setActionLoading(id);
    try {
      await adminApi.reviewReport(id, { status: newStatus, notes });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to update report');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Report Management</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="mb-6">
        <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="submitted">Submitted</option>
          <option value="under_review">Under Review</option>
          <option value="needs_more_info">Needs More Info</option>
          <option value="action_taken">Action Taken</option>
          <option value="rejected">Rejected</option>
          <option value="closed">Closed</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading reports..." />
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No reports found.</div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => {
            const transitions = STATUS_TRANSITIONS[report.status] || [];
            return (
              <div key={report._id} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-sm capitalize">{report.category?.replace(/_/g, ' ')}</span>
                      <StatusBadge status={report.status} />
                    </div>
                    <p className="text-sm text-gray-600">{report.description}</p>
                    <div className="flex gap-4 mt-2 text-xs text-gray-400">
                      <span>Reporter: <span className="font-mono">{report.reporterId || report.userId}</span></span>
                      {report.targetUserId && <span>Target: <span className="font-mono">{report.targetUserId}</span></span>}
                      <span>{formatDateTime(report.createdAt)}</span>
                    </div>
                    {report.statusHistory && report.statusHistory.length > 0 && (
                      <div className="mt-3 space-y-1">
                        {report.statusHistory.map((entry: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 text-xs">
                            <StatusBadge status={entry.status} size="sm" />
                            <span className="text-gray-400">{formatDateTime(entry.changedAt)}</span>
                            {entry.notes && <span className="text-gray-600">- {entry.notes}</span>}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  {transitions.length > 0 && (
                    <div className="flex gap-1 ml-4">
                      {transitions.map(t => (
                        <button
                          key={t}
                          onClick={() => setTransitionTarget({ id: report._id, status: t })}
                          disabled={actionLoading === report._id}
                          className="border px-2 py-1 rounded text-xs hover:bg-gray-50 disabled:opacity-50 capitalize"
                        >
                          {t.replace(/_/g, ' ')}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <NotesModal
        isOpen={!!transitionTarget}
        onClose={() => setTransitionTarget(null)}
        onSubmit={(notes) => {
          if (transitionTarget) handleTransition(transitionTarget.id, transitionTarget.status, notes);
          setTransitionTarget(null);
        }}
        title={transitionTarget ? `Transition to "${transitionTarget.status.replace(/_/g, ' ')}"` : 'Add Notes'}
        placeholder="Notes for this transition..."
        submitLabel="Confirm Transition"
      />
    </div>
  );
}
