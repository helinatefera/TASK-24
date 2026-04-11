import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin.api';
import { formatDateTime } from '../../utils/formatters';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function PrivacyPolicyEditorPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    version: '',
    content: '',
    changeSummary: '',
    effectiveDate: '',
  });
  const [expanded, setExpanded] = useState<string | null>(null);

  const fetchData = () => {
    setLoading(true);
    adminApi.getPrivacyPolicies()
      .then(res => setPolicies(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load policies'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await adminApi.createPrivacyPolicy({
        version: form.version,
        content: form.content,
        changeSummary: form.changeSummary,
        effectiveDate: form.effectiveDate || undefined,
      });
      setSuccess('Privacy policy created successfully.');
      setShowForm(false);
      setForm({ version: '', content: '', changeSummary: '', effectiveDate: '' });
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to create policy');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Privacy Policy Editor</h1>
        <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">
          {showForm ? 'Cancel' : 'Create New Version'}
        </button>
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Version *</label>
              <input type="text" value={form.version} onChange={e => setForm({ ...form, version: e.target.value })} required placeholder="e.g., 2.0" className="w-full border rounded px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Effective Date</label>
              <input type="date" value={form.effectiveDate} onChange={e => setForm({ ...form, effectiveDate: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Policy Content *</label>
            <textarea
              value={form.content}
              onChange={e => setForm({ ...form, content: e.target.value })}
              required
              rows={12}
              className="w-full border rounded px-3 py-2 text-sm font-mono"
              placeholder="Enter the full privacy policy text..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Change Summary</label>
            <input type="text" value={form.changeSummary} onChange={e => setForm({ ...form, changeSummary: e.target.value })} placeholder="Brief summary of changes from previous version" className="w-full border rounded px-3 py-2 text-sm" />
          </div>
          <button type="submit" disabled={saving} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700 disabled:opacity-50 text-sm">
            {saving ? 'Creating...' : 'Create Policy Version'}
          </button>
        </form>
      )}

      {loading ? (
        <LoadingSpinner message="Loading policies..." />
      ) : policies.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No privacy policies created yet.</div>
      ) : (
        <div className="space-y-4">
          {policies.map((policy: any, idx: number) => (
            <div key={policy._id || idx} className="bg-white rounded-lg shadow">
              <button
                onClick={() => setExpanded(expanded === policy._id ? null : policy._id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50"
              >
                <div className="flex items-center gap-3">
                  <span className="font-semibold text-sm">Version {policy.version || idx + 1}</span>
                  {idx === 0 && <span className="bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Latest</span>}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{formatDateTime(policy.effectiveDate || policy.createdAt)}</span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded === policy._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {expanded === policy._id && (
                <div className="px-6 pb-4 border-t">
                  {policy.changeSummary && (
                    <p className="text-sm text-gray-500 pt-3 mb-2"><strong>Changes:</strong> {policy.changeSummary}</p>
                  )}
                  <div className="pt-2 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded p-4 max-h-96 overflow-y-auto">
                    {policy.content || policy.text || 'No content.'}
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
