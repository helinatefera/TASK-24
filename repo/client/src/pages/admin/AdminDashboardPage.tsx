import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { adminApi } from '../../api/admin.api';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState({ users: 0, pendingReports: 0, pendingReviews: 0, pendingVerifications: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [usersRes, reportsRes, reviewsRes, verifRes] = await Promise.all([
          adminApi.getUsers({ limit: 1 }).catch(() => ({ data: { total: 0, items: [] } })),
          adminApi.getReports({ status: 'pending', limit: 1 }).catch(() => ({ data: { total: 0, items: [] } })),
          adminApi.getContentReviews({ status: 'pending', limit: 1 }).catch(() => ({ data: { total: 0, items: [] } })),
          adminApi.getVerificationRequests({ status: 'pending', limit: 1 }).catch(() => ({ data: { total: 0, items: [] } })),
        ]);
        setCounts({
          users: usersRes.data.total ?? (usersRes.data.items || usersRes.data || []).length,
          pendingReports: reportsRes.data.total ?? (reportsRes.data.items || reportsRes.data || []).length,
          pendingReviews: reviewsRes.data.total ?? (reviewsRes.data.items || reviewsRes.data || []).length,
          pendingVerifications: verifRes.data.total ?? (verifRes.data.items || verifRes.data || []).length,
        });
      } catch {}
      setLoading(false);
    };
    fetchCounts();
  }, []);

  if (loading) return <LoadingSpinner message="Loading admin dashboard..." />;

  const cards = [
    { label: 'Total Users', value: counts.users, link: '/admin/users', color: 'bg-blue-50 text-blue-700' },
    { label: 'Pending Reports', value: counts.pendingReports, link: '/admin/reports', color: 'bg-red-50 text-red-700' },
    { label: 'Content Reviews', value: counts.pendingReviews, link: '/admin/content-reviews', color: 'bg-yellow-50 text-yellow-700' },
    { label: 'Verification Requests', value: counts.pendingVerifications, link: '/admin/verifications', color: 'bg-purple-50 text-purple-700' },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Admin Dashboard</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <Link key={card.label} to={card.link} className={`${card.color} rounded-lg p-6 hover:shadow-md transition-shadow`}>
            <p className="text-sm font-medium opacity-75">{card.label}</p>
            <p className="text-3xl font-bold mt-2">{card.value}</p>
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link to="/admin/blacklist" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <h3 className="font-semibold">Blacklist Management</h3>
          <p className="text-sm text-gray-500 mt-1">Manage blocked users and entities</p>
        </Link>
        <Link to="/admin/audit" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <h3 className="font-semibold">Audit Logs</h3>
          <p className="text-sm text-gray-500 mt-1">View system activity and changes</p>
        </Link>
        <Link to="/admin/content-filter" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <h3 className="font-semibold">Content Filter Config</h3>
          <p className="text-sm text-gray-500 mt-1">Manage sensitive word list</p>
        </Link>
        <Link to="/admin/privacy-policy" className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
          <h3 className="font-semibold">Privacy Policy Editor</h3>
          <p className="text-sm text-gray-500 mt-1">Create and manage policy versions</p>
        </Link>
      </div>
    </div>
  );
}
