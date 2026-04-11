import { useAuth } from '../context/AuthContext';
import { useEffect, useState } from 'react';
import { jobsApi } from '../api/jobs.api';
import { Link } from 'react-router-dom';

export default function DashboardPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>({ jobs: [] });

  useEffect(() => {
    jobsApi.getAll({ limit: 5 }).then(res => setStats({ jobs: res.data.items || res.data || [] })).catch(() => {});
  }, []);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Welcome, {user?.username}</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-600 mb-2">Role</h3>
          <p className="text-2xl font-bold capitalize">{user?.role}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-600 mb-2">Recent Jobs</h3>
          <p className="text-2xl font-bold">{stats.jobs.length}</p>
        </div>
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold text-gray-600 mb-2">Quick Actions</h3>
          <div className="space-y-2">
            {user?.role === 'alumni' && <Link to="/jobs/create" className="block text-primary-600 hover:underline text-sm">Create a Job</Link>}
            {user?.role === 'photographer' && <Link to="/portfolio/upload" className="block text-primary-600 hover:underline text-sm">Upload Portfolio</Link>}
            {user?.role === 'admin' && <Link to="/admin" className="block text-primary-600 hover:underline text-sm">Admin Panel</Link>}
          </div>
        </div>
      </div>
      {stats.jobs.length > 0 && (
        <div className="mt-8 bg-white rounded-lg shadow p-6">
          <h3 className="font-semibold mb-4">Recent Jobs</h3>
          <table className="w-full text-sm">
            <thead><tr className="border-b"><th className="text-left py-2">Title</th><th className="text-left py-2">Type</th><th className="text-left py-2">Status</th></tr></thead>
            <tbody>
              {stats.jobs.map((job: any) => (
                <tr key={job._id} className="border-b"><td className="py-2"><Link to={`/jobs/${job._id}`} className="text-primary-600 hover:underline">{job.title}</Link></td><td className="py-2 capitalize">{job.jobType}</td><td className="py-2 capitalize">{job.status}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
