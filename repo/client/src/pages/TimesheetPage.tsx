import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs.api';
import { workEntriesApi } from '../api/workEntries.api';
import { useAuth } from '../context/AuthContext';
import { formatCents, formatDate } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import MoneyDisplay from '../components/shared/MoneyDisplay';

export default function TimesheetPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [entries, setEntries] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({
    entryType: 'time',
    date: new Date().toISOString().split('T')[0],
    startTime: '',
    endTime: '',
    durationMinutes: '',
    itemDescription: '',
    quantity: '',
    unitRateCents: '',
  });

  const fetchData = async () => {
    if (!jobId) return;
    try {
      const [jobRes, weRes] = await Promise.all([
        jobsApi.getById(jobId),
        jobsApi.getWorkEntries(jobId),
      ]);
      setJob(jobRes.data);
      setEntries(weRes.data.items || weRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to load timesheet');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [jobId]);

  const handleCreateEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId) return;
    setSaving(true);
    setError('');
    try {
      const payload: any = {
        entryType: form.entryType,
        date: form.date,
      };
      if (form.entryType === 'time') {
        if (form.startTime) payload.startTime = form.startTime;
        if (form.endTime) payload.endTime = form.endTime;
        const mins = parseInt(form.durationMinutes);
        if (isNaN(mins) || mins <= 0) {
          setError('Duration in minutes is required for time entries');
          setSaving(false);
          return;
        }
        payload.durationMinutes = mins;
      } else {
        payload.itemDescription = form.itemDescription;
        payload.quantity = parseInt(form.quantity) || 1;
        payload.unitRateCents = Math.round(parseFloat(form.unitRateCents) * 100) || 0;
      }
      await jobsApi.createWorkEntry(jobId, payload);
      setShowForm(false);
      setForm({ entryType: 'time', date: new Date().toISOString().split('T')[0], startTime: '', endTime: '', durationMinutes: '', itemDescription: '', quantity: '', unitRateCents: '' });
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to create entry');
    } finally {
      setSaving(false);
    }
  };

  const handleConfirm = async (entryId: string) => {
    try {
      await workEntriesApi.confirm(entryId);
      await fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to confirm entry');
    }
  };

  if (loading) return <LoadingSpinner message="Loading timesheet..." />;

  const total = entries.reduce((sum: number, e: any) => sum + (e.subtotalCents || 0), 0);
  const isPhotographer = user?._id === job?.photographerId;
  const isClient = user?._id === job?.clientId;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Timesheet</h1>
          {job && <p className="text-sm text-gray-500 mt-1">Job: <Link to={`/jobs/${jobId}`} className="text-primary-600 hover:underline">{job.title}</Link></p>}
        </div>
        {isPhotographer && (
          <button onClick={() => setShowForm(!showForm)} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">
            {showForm ? 'Cancel' : 'Add Entry'}
          </button>
        )}
      </div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      {showForm && (
        <form onSubmit={handleCreateEntry} className="bg-white rounded-lg shadow p-6 mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Entry Type</label>
              <select value={form.entryType} onChange={e => setForm({ ...form, entryType: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
                <option value="time">Time</option>
                <option value="piece_rate">Piece Rate</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
              <input type="date" value={form.date} onChange={e => setForm({ ...form, date: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
            </div>
          </div>
          {form.entryType === 'time' ? (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                <input type="time" value={form.startTime} onChange={e => setForm({ ...form, startTime: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                <input type="time" value={form.endTime} onChange={e => setForm({ ...form, endTime: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Duration (min)</label>
                <input type="number" min="15" step="15" value={form.durationMinutes} onChange={e => setForm({ ...form, durationMinutes: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g. 60" />
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Item Description</label>
                <input type="text" value={form.itemDescription} onChange={e => setForm({ ...form, itemDescription: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                <input type="number" min="1" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Rate ($)</label>
                <input type="number" step="0.01" min="0" value={form.unitRateCents} onChange={e => setForm({ ...form, unitRateCents: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
              </div>
            </div>
          )}
          <button type="submit" disabled={saving} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 disabled:opacity-50">
            {saving ? 'Saving...' : 'Add Entry'}
          </button>
        </form>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        {entries.length === 0 ? (
          <p className="p-8 text-center text-sm text-gray-500">No work entries recorded yet.</p>
        ) : (
          <>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-gray-50">
                  <th className="text-left px-6 py-3">Date</th>
                  <th className="text-left px-6 py-3">Type</th>
                  <th className="text-left px-6 py-3">Details</th>
                  <th className="text-right px-6 py-3">Subtotal</th>
                  <th className="text-left px-6 py-3">Status</th>
                  <th className="text-left px-6 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry: any) => (
                  <tr key={entry._id} className="border-b">
                    <td className="px-6 py-3">{entry.date ? formatDate(entry.date) : '-'}</td>
                    <td className="px-6 py-3 capitalize">{entry.entryType?.replace('_', ' ')}</td>
                    <td className="px-6 py-3 text-gray-600">
                      {entry.entryType === 'time'
                        ? `${entry.durationMinutes || 0} min${entry.startTime ? ` (${entry.startTime} - ${entry.endTime})` : ''}`
                        : `${entry.quantity || 0} x ${entry.itemDescription || '-'} @ ${formatCents(entry.unitRateCents || 0)}`}
                    </td>
                    <td className="px-6 py-3 text-right"><MoneyDisplay cents={entry.subtotalCents || 0} /></td>
                    <td className="px-6 py-3">
                      {entry.isLocked ? (
                        <span className="text-green-600 text-xs">Locked</span>
                      ) : (
                        <span className="text-yellow-600 text-xs">Pending</span>
                      )}
                    </td>
                    <td className="px-6 py-3">
                      {!entry.isLocked && (isClient && !entry.clientConfirmedAt || isPhotographer && !entry.photographerConfirmedAt) && (
                        <button onClick={() => handleConfirm(entry._id)} className="text-primary-600 hover:underline text-xs">Confirm</button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold">
                  <td colSpan={3} className="px-6 py-3 text-right">Total:</td>
                  <td className="px-6 py-3 text-right"><MoneyDisplay cents={total} /></td>
                  <td colSpan={2}></td>
                </tr>
              </tfoot>
            </table>
          </>
        )}
      </div>
    </div>
  );
}
