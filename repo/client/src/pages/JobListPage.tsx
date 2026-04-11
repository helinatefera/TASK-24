import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs.api';
import { useAuth } from '../context/AuthContext';
import { formatCents, formatDate } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';

export default function JobListPage() {
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ status: '', jobType: '', search: '' });

  useEffect(() => {
    const params: any = {};
    if (filters.status) params.status = filters.status;
    if (filters.jobType) params.jobType = filters.jobType;
    if (filters.search) params.search = filters.search;
    setLoading(true);
    jobsApi.getAll(params)
      .then(res => setJobs(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load jobs'))
      .finally(() => setLoading(false));
  }, [filters]);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Jobs</h1>
        {user?.role === 'alumni' && (
          <Link to="/jobs/create" className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">
            Create Job
          </Link>
        )}
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="flex flex-wrap gap-3 mb-6">
        <input
          type="text"
          placeholder="Search jobs..."
          value={filters.search}
          onChange={e => setFilters({ ...filters, search: e.target.value })}
          className="border rounded px-3 py-2 text-sm flex-1 min-w-[200px]"
        />
        <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value })} className="border rounded px-3 py-2 text-sm">
          <option value="">All Statuses</option>
          <option value="open">Open</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In Progress</option>
          <option value="completed">Completed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <select value={filters.jobType} onChange={e => setFilters({ ...filters, jobType: e.target.value })} className="border rounded px-3 py-2 text-sm">
          <option value="">All Types</option>
          <option value="event">Event</option>
          <option value="portrait">Portrait</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading jobs..." />
      ) : jobs.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No jobs found.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3">Title</th>
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Rate</th>
                <th className="text-left px-6 py-3">Budget</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-left px-6 py-3">Created</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(job => (
                <tr key={job._id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link to={`/jobs/${job._id}`} className="text-primary-600 hover:underline font-medium">
                      {job.title}
                    </Link>
                  </td>
                  <td className="px-6 py-3 capitalize">{job.jobType}</td>
                  <td className="px-6 py-3">
                    <span className="capitalize">{job.rateType?.replace('_', ' ')}</span>
                    {' '}{formatCents(job.agreedRateCents || 0)}
                  </td>
                  <td className="px-6 py-3 font-mono">{formatCents(job.estimatedTotalCents || 0)}</td>
                  <td className="px-6 py-3"><StatusBadge status={job.status} /></td>
                  <td className="px-6 py-3 text-gray-500">{formatDate(job.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
