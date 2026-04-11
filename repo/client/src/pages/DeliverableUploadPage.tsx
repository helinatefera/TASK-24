import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { jobsApi } from '../api/jobs.api';
import FileUpload from '../components/shared/FileUpload';

export default function DeliverableUploadPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [files, setFiles] = useState<File[]>([]);
  const [copyrightNotice, setCopyrightNotice] = useState('');
  const [description, setDescription] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!jobId || files.length === 0) { setError('Please select at least one file.'); return; }
    if (!copyrightNotice.trim()) { setError('Copyright notice is required.'); return; }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('copyrightNotice', copyrightNotice);
        formData.append('description', description);
        await jobsApi.uploadDeliverable(jobId, formData);
      }
      setSuccess(`${files.length} deliverable(s) uploaded successfully.`);
      setFiles([]);
      setDescription('');
      setTimeout(() => navigate(`/jobs/${jobId}`), 1500);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to upload deliverable');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload Deliverable</h1>
      <p className="text-sm text-gray-500 mb-4">Job ID: <span className="font-mono">{jobId}</span></p>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
        <FileUpload
          onFilesSelected={setFiles}
          accept=".pdf,.jpg,.jpeg,.png"
          multiple={true}
          label="Deliverable Files"
          maxSizeMB={10}
        />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
          <textarea value={description} onChange={e => setDescription(e.target.value)} rows={3} className="w-full border rounded px-3 py-2 text-sm" placeholder="Describe the deliverable..." />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Copyright Notice *</label>
          <input
            type="text"
            value={copyrightNotice}
            onChange={e => setCopyrightNotice(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="e.g., (c) 2026 Photographer Name. All rights reserved."
          />
          <p className="text-xs text-gray-500 mt-1">By uploading, you confirm you own the copyright or have authorization.</p>
        </div>
        <div className="flex gap-3">
          <button type="submit" disabled={uploading || files.length === 0} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700 disabled:opacity-50 text-sm">
            {uploading ? 'Uploading...' : `Upload ${files.length} File(s)`}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="border px-6 py-2 rounded text-sm hover:bg-gray-50">Cancel</button>
        </div>
      </form>
    </div>
  );
}
