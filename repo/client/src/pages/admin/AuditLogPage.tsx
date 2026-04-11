import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin.api';
import { formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import StatusBadge from '../../components/shared/StatusBadge';

export default function AuditLogPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ action: '', resource: '', actorId: '', startDate: '', endDate: '' });
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    const params: any = {};
    if (filters.action) params.action = filters.action;
    if (filters.resource) params.resource = filters.resource;
    if (filters.actorId) params.actorId = filters.actorId;
    if (filters.startDate) params.startDate = filters.startDate;
    if (filters.endDate) params.endDate = filters.endDate;
    adminApi.getAuditLogs(params)
      .then(res => setLogs(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load audit logs'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleFilter = () => { fetchData(); };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Audit Logs</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Action</label>
            <input type="text" value={filters.action} onChange={e => setFilters({ ...filters, action: e.target.value })} placeholder="e.g., create" className="border rounded px-2 py-1.5 text-sm w-32" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Resource</label>
            <input type="text" value={filters.resource} onChange={e => setFilters({ ...filters, resource: e.target.value })} placeholder="e.g., user" className="border rounded px-2 py-1.5 text-sm w-32" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Actor ID</label>
            <input type="text" value={filters.actorId} onChange={e => setFilters({ ...filters, actorId: e.target.value })} placeholder="User ID" className="border rounded px-2 py-1.5 text-sm w-40" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">Start Date</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({ ...filters, startDate: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">End Date</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({ ...filters, endDate: e.target.value })} className="border rounded px-2 py-1.5 text-sm" />
          </div>
          <button onClick={handleFilter} className="bg-primary-600 text-white px-4 py-1.5 rounded text-sm hover:bg-primary-700">
            Filter
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading audit logs..." />
      ) : logs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No audit log entries found.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3">Timestamp</th>
                <th className="text-left px-4 py-3">Action</th>
                <th className="text-left px-4 py-3">Resource</th>
                <th className="text-left px-4 py-3">Actor</th>
                <th className="text-left px-4 py-3">Outcome</th>
                <th className="text-left px-4 py-3">Details</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log._id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 text-xs whitespace-nowrap">{formatDateTime(log.timestamp)}</td>
                  <td className="px-4 py-3 capitalize">{log.action}</td>
                  <td className="px-4 py-3">{log.resource}</td>
                  <td className="px-4 py-3 font-mono text-xs">{log.actorId || 'system'}</td>
                  <td className="px-4 py-3"><StatusBadge status={log.outcome} /></td>
                  <td className="px-4 py-3">
                    {log.details && (
                      <button
                        onClick={() => setExpanded(expanded === log._id ? null : log._id)}
                        className="text-primary-600 hover:underline text-xs"
                      >
                        {expanded === log._id ? 'Hide' : 'Show'}
                      </button>
                    )}
                    {expanded === log._id && log.details && (
                      <pre className="mt-2 bg-gray-50 p-2 rounded text-xs overflow-x-auto max-w-xs">
                        {JSON.stringify(log.details, null, 2)}
                      </pre>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
