import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { reportsApi } from '../api/reports.api';
import FileUpload from '../components/shared/FileUpload';

const CATEGORIES = [
  'harassment',
  'copyright_violation',
  'fraud',
  'inappropriate_content',
  'spam',
  'other',
];

export default function ReportCreatePage() {
  const navigate = useNavigate();
  const [form, setForm] = useState({ category: 'harassment', description: '', targetUserId: '', targetContentId: '' });
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      formData.append('category', form.category);
      formData.append('description', form.description);
      if (form.targetUserId) formData.append('targetUserId', form.targetUserId);
      if (form.targetContentId) formData.append('targetContentId', form.targetContentId);
      files.forEach(f => formData.append('evidence', f));
      await reportsApi.create(formData);
      setSuccess('Report submitted successfully.');
      setTimeout(() => navigate('/reports'), 1500);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to submit report');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Submit a Report</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="w-full border rounded px-3 py-2 text-sm">
            {CATEGORIES.map(c => (
              <option key={c} value={c}>{c.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description *</label>
          <textarea
            value={form.description}
            onChange={e => setForm({ ...form, description: e.target.value })}
            required
            rows={5}
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="Please describe the issue in detail..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Target User ID (optional)</label>
            <input type="text" value={form.targetUserId} onChange={e => setForm({ ...form, targetUserId: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="User being reported" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Content ID (optional)</label>
            <input type="text" value={form.targetContentId} onChange={e => setForm({ ...form, targetContentId: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" placeholder="Specific content ID" />
          </div>
        </div>
        <FileUpload
          onFilesSelected={setFiles}
          accept=".pdf,.jpg,.jpeg,.png"
          multiple={true}
          label="Evidence (optional)"
          maxSizeMB={10}
        />
        <div className="flex gap-3">
          <button type="submit" disabled={loading} className="bg-red-600 text-white px-6 py-2 rounded hover:bg-red-700 disabled:opacity-50 text-sm">
            {loading ? 'Submitting...' : 'Submit Report'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="border px-6 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}
