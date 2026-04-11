import { useEffect, useState } from 'react';
import { consentApi } from '../api/consent.api';
import { formatDateTime } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function PrivacyPolicyHistoryPage() {
  const [policies, setPolicies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    consentApi.getPolicyHistory()
      .then(res => setPolicies(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load policy history'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading policy history..." />;

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Privacy Policy History</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {policies.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-6 text-gray-500 text-sm">No policy versions found.</div>
      ) : (
        <div className="space-y-4">
          {policies.map((policy: any, idx: number) => (
            <div key={policy._id || idx} className="bg-white rounded-lg shadow">
              <button
                onClick={() => setExpanded(expanded === policy._id ? null : policy._id)}
                className="w-full flex items-center justify-between px-6 py-4 text-left hover:bg-gray-50"
              >
                <div>
                  <span className="font-semibold text-sm">Version {policy.version || idx + 1}</span>
                  {idx === 0 && <span className="ml-2 bg-green-100 text-green-800 text-xs px-2 py-0.5 rounded-full">Current</span>}
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-sm text-gray-500">
                    {formatDateTime(policy.effectiveDate || policy.createdAt)}
                  </span>
                  <svg className={`w-4 h-4 text-gray-400 transition-transform ${expanded === policy._id ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </button>
              {expanded === policy._id && (
                <div className="px-6 pb-4 border-t">
                  <div className="pt-4 text-sm text-gray-700 whitespace-pre-wrap">
                    {policy.content || policy.text || 'No content available.'}
                  </div>
                  {policy.changeSummary && (
                    <div className="mt-3 text-xs text-gray-500">
                      <strong>Changes:</strong> {policy.changeSummary}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
