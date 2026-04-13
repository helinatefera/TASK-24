import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { reportsApi } from '../api/reports.api';
import { formatDateTime } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';

export default function ReportListPage() {
  const [reports, setReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    reportsApi.getMyReports()
      .then(res => setReports(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load reports'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading reports..." />;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">My Reports</h1>
        <Link to="/reports/new" className="bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
          New Report
        </Link>
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      {reports.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          You have not submitted any reports.
        </div>
      ) : (
        <div className="space-y-4">
          {reports.map(report => (
            <div key={report._id} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm capitalize">{report.category?.replace(/_/g, ' ')}</span>
                    <StatusBadge status={report.status} />
                  </div>
                  <p className="text-sm text-gray-600 mt-2">{report.description}</p>
                  <p className="text-xs text-gray-400 mt-2">Submitted: {formatDateTime(report.createdAt)}</p>
                </div>
              </div>

              {report.statusHistory && report.statusHistory.length > 0 && (
                <div className="mt-4 border-t pt-4">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Status Timeline</h4>
                  <div className="space-y-2">
                    {report.statusHistory.map((entry: any, idx: number) => (
                      <div key={idx} className="flex items-start gap-3">
                        <div className="flex flex-col items-center">
                          <div className={`w-2.5 h-2.5 rounded-full mt-1.5 ${idx === 0 ? 'bg-primary-600' : 'bg-gray-300'}`} />
                          {idx < report.statusHistory.length - 1 && <div className="w-px h-6 bg-gray-200" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <StatusBadge status={entry.status} size="sm" />
                            <span className="text-xs text-gray-400">{formatDateTime(entry.changedAt)}</span>
                          </div>
                          {entry.notes && <p className="text-xs text-gray-600 mt-1">{entry.notes}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
