import { useEffect, useState } from 'react';
import { consentApi } from '../api/consent.api';
import { formatDateTime } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';

export default function ConsentManagementPage() {
  const [history, setHistory] = useState<any[]>([]);
  const [consents, setConsents] = useState<any[]>([]);
  const [dataCategories, setDataCategories] = useState<string[]>([]);
  const [currentPolicy, setCurrentPolicy] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState('');

  const fetchData = async () => {
    try {
      const [histRes, catRes, polRes, dcRes] = await Promise.all([
        consentApi.getHistory(),
        consentApi.getCategoryConsents(),
        consentApi.getCurrentPolicy().catch(() => ({ data: null })),
        consentApi.getDataCategories().catch(() => ({ data: { categories: [] } })),
      ]);
      setHistory(histRes.data.items || histRes.data || []);
      setConsents(catRes.data.items || catRes.data || []);
      setCurrentPolicy(polRes.data);
      const cats = dcRes.data.categories || dcRes.data || [];
      if (cats.length > 0) setDataCategories(cats);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to load consent data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleGrantConsent = async (category: string) => {
    setActionLoading(category);
    try {
      await consentApi.recordCategoryConsent({ category });
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to grant consent');
    } finally {
      setActionLoading('');
    }
  };

  const handleRevoke = async (category: string) => {
    if (!confirm(`Revoke consent for ${category.replace(/_/g, ' ')}?`)) return;
    setActionLoading(category);
    try {
      await consentApi.revokeCategoryConsent(category);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to revoke consent');
    } finally {
      setActionLoading('');
    }
  };

  const handleAcceptPolicy = async () => {
    if (!currentPolicy) return;
    setActionLoading('policy');
    try {
      await consentApi.recordConsent({ policyVersion: currentPolicy.version, accepted: true });
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to record consent');
    } finally {
      setActionLoading('');
    }
  };

  if (loading) return <LoadingSpinner message="Loading consent data..." />;

  const consentedCategories = new Set(consents.map((c: any) => c.category));

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Consent Management</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      {currentPolicy && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold mb-2">Current Privacy Policy</h2>
          <p className="text-sm text-gray-600 mb-1">Version: {currentPolicy.version}</p>
          <p className="text-sm text-gray-600 mb-3">Effective: {formatDateTime(currentPolicy.effectiveDate || currentPolicy.createdAt)}</p>
          <button
            onClick={handleAcceptPolicy}
            disabled={actionLoading === 'policy'}
            className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 disabled:opacity-50"
          >
            {actionLoading === 'policy' ? 'Recording...' : 'Accept Current Policy'}
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow mb-6">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Data Categories</h2>
          <p className="text-xs text-gray-500 mt-1">Manage consent for each data processing category</p>
        </div>
        <div className="divide-y">
          {dataCategories.map(cat => {
            const isConsented = consentedCategories.has(cat);
            return (
              <div key={cat} className="flex items-center justify-between px-6 py-4">
                <div>
                  <span className="text-sm font-medium capitalize">{cat.replace(/_/g, ' ')}</span>
                  <span className="ml-2">
                    <StatusBadge status={isConsented ? 'active' : 'pending'} />
                  </span>
                </div>
                {isConsented ? (
                  <button
                    onClick={() => handleRevoke(cat)}
                    disabled={actionLoading === cat}
                    className="text-red-600 text-sm hover:underline disabled:opacity-50"
                  >
                    {actionLoading === cat ? 'Revoking...' : 'Revoke'}
                  </button>
                ) : (
                  <button
                    onClick={() => handleGrantConsent(cat)}
                    disabled={actionLoading === cat}
                    className="text-primary-600 text-sm hover:underline disabled:opacity-50"
                  >
                    {actionLoading === cat ? 'Granting...' : 'Grant Consent'}
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b">
          <h2 className="font-semibold">Consent History</h2>
        </div>
        {history.length === 0 ? (
          <p className="p-6 text-sm text-gray-500">No consent history yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead><tr className="border-b bg-gray-50"><th className="text-left px-6 py-3">Action</th><th className="text-left px-6 py-3">Date</th><th className="text-left px-6 py-3">Details</th></tr></thead>
            <tbody>
              {history.map((h: any, i: number) => (
                <tr key={h._id || i} className="border-b">
                  <td className="px-6 py-3 capitalize">{h.action || h.type || 'consent'}</td>
                  <td className="px-6 py-3">{formatDateTime(h.createdAt || h.timestamp)}</td>
                  <td className="px-6 py-3 text-gray-600">{h.category || h.policyVersion || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
