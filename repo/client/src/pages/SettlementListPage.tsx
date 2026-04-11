import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs.api';
import { settlementsApi } from '../api/settlements.api';
import { formatCents, formatDate } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';
import MoneyDisplay from '../components/shared/MoneyDisplay';

export default function SettlementListPage() {
  const [settlements, setSettlements] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    jobsApi.getAll({ status: 'completed' })
      .then(async (res) => {
        const jobs = res.data.items || res.data || [];
        const settlementPromises = jobs.map(async (job: any) => {
          try {
            if (job.settlementId) {
              const sRes = await settlementsApi.getById(job.settlementId);
              return { ...sRes.data, jobTitle: job.title };
            }
          } catch {}
          return null;
        });
        const results = await Promise.all(settlementPromises);
        setSettlements(results.filter(Boolean));
      })
      .catch(err => setError(err.response?.data?.msg || 'Failed to load settlements'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading settlements..." />;

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Settlements</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      {settlements.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">
          No settlements found. Settlements are generated when jobs are completed.
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-gray-50">
                <th className="text-left px-6 py-3">Job</th>
                <th className="text-left px-6 py-3">Status</th>
                <th className="text-right px-6 py-3">Subtotal</th>
                <th className="text-right px-6 py-3">Adjustments</th>
                <th className="text-right px-6 py-3">Final Amount</th>
                <th className="text-left px-6 py-3">Approvals</th>
                <th className="text-left px-6 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {settlements.map(s => (
                <tr key={s._id} className="border-b hover:bg-gray-50">
                  <td className="px-6 py-3">
                    <Link to={`/jobs/${s.jobId}`} className="text-primary-600 hover:underline">{s.jobTitle || s.jobId}</Link>
                  </td>
                  <td className="px-6 py-3"><StatusBadge status={s.status} /></td>
                  <td className="px-6 py-3 text-right"><MoneyDisplay cents={s.subtotalCents || 0} /></td>
                  <td className="px-6 py-3 text-right"><MoneyDisplay cents={s.adjustmentCents || 0} showSign /></td>
                  <td className="px-6 py-3 text-right font-semibold"><MoneyDisplay cents={s.finalAmountCents || 0} /></td>
                  <td className="px-6 py-3 text-xs">
                    <span className={s.photographerApproved ? 'text-green-600' : 'text-gray-400'}>Photo {s.photographerApproved ? 'Yes' : 'No'}</span>
                    {' / '}
                    <span className={s.clientApproved ? 'text-green-600' : 'text-gray-400'}>Client {s.clientApproved ? 'Yes' : 'No'}</span>
                  </td>
                  <td className="px-6 py-3">
                    <Link to={`/settlements/${s._id}`} className="text-primary-600 hover:underline text-xs">View</Link>
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
