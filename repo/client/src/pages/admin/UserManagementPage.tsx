import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin.api';
import { formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../../components/shared/LoadingSpinner';
import StatusBadge from '../../components/shared/StatusBadge';

export default function UserManagementPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchUsers = () => {
    setLoading(true);
    const params: any = {};
    if (search) params.search = search;
    if (roleFilter) params.role = roleFilter;
    adminApi.getUsers(params)
      .then(res => setUsers(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load users'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchUsers(); }, [search, roleFilter]);

  const handleRoleChange = async (userId: string, newRole: string) => {
    setActionLoading(userId);
    try {
      await adminApi.updateUserRole(userId, newRole);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to update role');
    } finally {
      setActionLoading('');
    }
  };

  const handleStatusChange = async (userId: string, newStatus: string) => {
    setActionLoading(userId);
    try {
      await adminApi.updateUserStatus(userId, newStatus);
      fetchUsers();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to update status');
    } finally {
      setActionLoading('');
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">User Management</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="flex gap-3 mb-6">
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="border rounded px-3 py-2 text-sm">
          <option value="">All Roles</option>
          <option value="alumni">Alumni</option>
          <option value="photographer">Photographer</option>
          <option value="admin">Admin</option>
        </select>
      </div>

      {loading ? (
        <LoadingSpinner message="Loading users..." />
      ) : users.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No users found.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-4 py-3">Username</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Role</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u._id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium">{u.username}</td>
                  <td className="px-4 py-3 text-gray-600">{u.email}</td>
                  <td className="px-4 py-3">
                    <select
                      value={u.role}
                      onChange={e => handleRoleChange(u._id, e.target.value)}
                      disabled={actionLoading === u._id}
                      className="border rounded px-2 py-1 text-xs"
                    >
                      <option value="alumni">Alumni</option>
                      <option value="photographer">Photographer</option>
                      <option value="admin">Admin</option>
                    </select>
                  </td>
                  <td className="px-4 py-3"><StatusBadge status={u.accountStatus || 'active'} /></td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      {u.accountStatus !== 'suspended' ? (
                        <button
                          onClick={() => handleStatusChange(u._id, 'suspended')}
                          disabled={actionLoading === u._id}
                          className="text-red-600 hover:underline text-xs disabled:opacity-50"
                        >
                          Suspend
                        </button>
                      ) : (
                        <button
                          onClick={() => handleStatusChange(u._id, 'active')}
                          disabled={actionLoading === u._id}
                          className="text-green-600 hover:underline text-xs disabled:opacity-50"
                        >
                          Activate
                        </button>
                      )}
                    </div>
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
