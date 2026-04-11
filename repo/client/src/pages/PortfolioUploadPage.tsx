import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { portfoliosApi } from '../api/portfolios.api';
import { useAuth } from '../context/AuthContext';
import FileUpload from '../components/shared/FileUpload';

export default function PortfolioUploadPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [selectedPortfolio, setSelectedPortfolio] = useState(id || '');
  const [files, setFiles] = useState<File[]>([]);
  const [copyrightNotice, setCopyrightNotice] = useState('');
  const [caption, setCaption] = useState('');
  const [watermarkEnabled, setWatermarkEnabled] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // New portfolio form
  const [showCreate, setShowCreate] = useState(false);
  const [newPortfolio, setNewPortfolio] = useState({ title: '', description: '', specialties: '' });

  useEffect(() => {
    portfoliosApi.getAll({ photographerId: user?._id })
      .then(res => {
        const items = res.data.items || res.data || [];
        setPortfolios(items);
        if (!selectedPortfolio && items.length > 0) setSelectedPortfolio(items[0]._id);
      })
      .catch(() => {});
  }, [user]);

  const handleCreatePortfolio = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const res = await portfoliosApi.create({
        title: newPortfolio.title,
        description: newPortfolio.description,
        specialties: newPortfolio.specialties.split(',').map(s => s.trim()).filter(Boolean),
      });
      const created = res.data;
      setPortfolios([...portfolios, created]);
      setSelectedPortfolio(created._id);
      setShowCreate(false);
      setNewPortfolio({ title: '', description: '', specialties: '' });
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to create portfolio');
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPortfolio || files.length === 0) {
      setError('Please select a portfolio and at least one file.');
      return;
    }
    setUploading(true);
    setError('');
    setSuccess('');
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append('image', file);
        formData.append('copyrightNotice', copyrightNotice);
        formData.append('caption', caption);
        formData.append('watermarkEnabled', String(watermarkEnabled));
        await portfoliosApi.addImage(selectedPortfolio, formData);
      }
      setSuccess(`${files.length} image(s) uploaded successfully.`);
      setFiles([]);
      setCaption('');
      setTimeout(() => navigate(`/portfolios/${selectedPortfolio}`), 1500);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to upload images');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Upload Portfolio Images</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}

      <form onSubmit={handleUpload} className="bg-white rounded-lg shadow p-6 space-y-5">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Portfolio</label>
          <div className="flex gap-2">
            <select
              value={selectedPortfolio}
              onChange={e => setSelectedPortfolio(e.target.value)}
              className="flex-1 border rounded px-3 py-2 text-sm"
            >
              <option value="">Select a portfolio...</option>
              {portfolios.map(p => (
                <option key={p._id} value={p._id}>{p.title}</option>
              ))}
            </select>
            <button type="button" onClick={() => setShowCreate(!showCreate)} className="border px-3 py-2 rounded text-sm hover:bg-gray-50">
              {showCreate ? 'Cancel' : '+ New'}
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="border rounded p-4 bg-gray-50 space-y-3">
            <input type="text" placeholder="Portfolio title" value={newPortfolio.title} onChange={e => setNewPortfolio({ ...newPortfolio, title: e.target.value })} required className="w-full border rounded px-3 py-2 text-sm" />
            <input type="text" placeholder="Description" value={newPortfolio.description} onChange={e => setNewPortfolio({ ...newPortfolio, description: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            <input type="text" placeholder="Specialties (comma-separated)" value={newPortfolio.specialties} onChange={e => setNewPortfolio({ ...newPortfolio, specialties: e.target.value })} className="w-full border rounded px-3 py-2 text-sm" />
            <button type="button" onClick={handleCreatePortfolio} className="bg-primary-600 text-white px-4 py-1.5 rounded text-sm hover:bg-primary-700">Create Portfolio</button>
          </div>
        )}

        <FileUpload
          onFilesSelected={setFiles}
          accept=".jpg,.jpeg,.png"
          multiple={true}
          label="Images"
          maxSizeMB={10}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Caption</label>
          <input type="text" value={caption} onChange={e => setCaption(e.target.value)} className="w-full border rounded px-3 py-2 text-sm" placeholder="Optional caption for all images" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Copyright Notice *</label>
          <input
            type="text"
            value={copyrightNotice}
            onChange={e => setCopyrightNotice(e.target.value)}
            required
            className="w-full border rounded px-3 py-2 text-sm"
            placeholder="e.g., (c) 2026 John Smith. All rights reserved."
          />
          <p className="text-xs text-gray-500 mt-1">You must have the rights to upload these images.</p>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="watermarkEnabled"
            checked={watermarkEnabled}
            onChange={e => setWatermarkEnabled(e.target.checked)}
            className="rounded border-gray-300"
          />
          <label htmlFor="watermarkEnabled" className="text-sm font-medium text-gray-700">Apply watermark to preview images</label>
          <p className="text-xs text-gray-500 ml-1">(Uses copyright notice as overlay text)</p>
        </div>

        <button type="submit" disabled={uploading || files.length === 0} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700 disabled:opacity-50 text-sm">
          {uploading ? 'Uploading...' : `Upload ${files.length} Image(s)`}
        </button>
      </form>
    </div>
  );
}
