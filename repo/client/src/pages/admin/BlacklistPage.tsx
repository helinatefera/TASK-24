import { useEffect, useState } from 'react';
import apiClient from '../../api/client';
import { adminApi } from '../../api/admin.api';
import { formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function BlacklistPage() {
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ type: 'email', value: '', reason: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState('');

  const fetchData = () => {
    setLoading(true);
    apiClient.get('/admin/blacklist')
      .then(res => setEntries(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load blacklist'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await adminApi.addBlacklist(form);
      setShowForm(false);
      setForm({ type: 'email', value: '', reason: '' });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to add to blacklist');
    } finally {
      setSaving(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this entry from the blacklist?')) return;
    setDeleting(id);
    try {
      await adminApi.removeBlacklist(id);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to remove from blacklist');
    } finally {
      setDeleting('');
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Blacklist Management</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">
          {showForm ? 'Cancel' : 'Add Entry'}
        </button>
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      {showForm && (
        <form onSubmit={handleAdd} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
              <select value={form.type} onChange={e => setForm({ ...form, type: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
                <option value="email">Email</option>
                <option value="domain">Domain</option>
                <option value="ip">IP Address</option>
                <option value="user_id">User ID</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Value</label>
              <input type="text" value={form.value} onChange={e => setForm({ ...form, value: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g., spam@example.com" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Reason</label>
              <input type="text" value={form.reason} onChange={e => setForm({ ...form, reason: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <button type="submit" disabled={saving} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Adding...' : 'Add to Blacklist'}
          </button>
        </form>
      )}

      {loading ? (
        <LoadingSpinner message="Loading blacklist..." />
      ) : entries.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">Blacklist is empty.</div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3">Type</th>
                <th className="text-left px-6 py-3">Value</th>
                <th className="text-left px-6 py-3">Reason</th>
                <th className="text-left px-6 py-3">Added</th>
                <th className="text-left px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry: any) => (
                <tr key={entry._id} className="border-b">
                  <td className="px-6 py-3 capitalize">{entry.type}</td>
                  <td className="px-6 py-3 font-mono text-xs">{entry.value}</td>
                  <td className="px-6 py-3 text-gray-600">{entry.reason}</td>
                  <td className="px-6 py-3 text-gray-500">{formatDateTime(entry.createdAt)}</td>
                  <td className="px-6 py-3">
                    <button
                      onClick={() => handleRemove(entry._id)}
                      disabled={deleting === entry._id}
                      className="text-red-600 hover:underline text-xs disabled:opacity-50"
                    >
                      Remove
                    </button>
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
