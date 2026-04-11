import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs.api';

export default function JobCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    title: '',
    description: '',
    jobType: 'event',
    rateType: 'hourly',
    agreedRateCents: '',
    estimatedTotalCents: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const payload = {
        ...form,
        agreedRateCents: Math.round(parseFloat(form.agreedRateCents) * 100) || 0,
        estimatedTotalCents: Math.round(parseFloat(form.estimatedTotalCents) * 100) || 0,
      };
      const res = await jobsApi.create(payload);
      navigate(`/jobs/${res.data._id}`);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to create job');
    } finally {
      setLoading(false);
    }
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm({ ...form, [field]: e.target.value });

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Create New Job</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
          <input type="text" value={form.title} onChange={set('title')} required className="w-full border rounded px-3 py-2 text-sm" placeholder="e.g., Wedding Photography - Smith/Jones" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea value={form.description} onChange={set('description')} required rows={4} className="w-full border rounded px-3 py-2 text-sm" placeholder="Describe the job requirements, location, timing..." />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Job Type *</label>
            <select value={form.jobType} onChange={set('jobType')} className="w-full border rounded px-3 py-2 text-sm">
              <option value="event">Event</option>
              <option value="portrait">Portrait</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rate Type *</label>
            <select value={form.rateType} onChange={set('rateType')} className="w-full border rounded px-3 py-2 text-sm">
              <option value="hourly">Hourly</option>
              <option value="piece_rate">Piece Rate</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Agreed Rate ($) *</label>
            <input type="number" step="0.01" min="0" value={form.agreedRateCents} onChange={set('agreedRateCents')} required className="w-full border rounded px-3 py-2 text-sm" placeholder="0.00" />
            <p className="text-xs text-gray-500 mt-1">{form.rateType === 'hourly' ? 'Per hour' : 'Per item'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Estimated Total ($) *</label>
            <input type="number" step="0.01" min="0" value={form.estimatedTotalCents} onChange={set('estimatedTotalCents')} required className="w-full border rounded px-3 py-2 text-sm" placeholder="0.00" />
          </div>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={loading} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700 disabled:opacity-50 text-sm">
            {loading ? 'Creating...' : 'Create Job'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="border px-6 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}
