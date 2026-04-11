import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { portfoliosApi } from '../api/portfolios.api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';

export default function PortfolioPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [portfolio, setPortfolio] = useState<any>(null);
  const [portfolios, setPortfolios] = useState<any[]>([]);
  const [images, setImages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState('');
  // Track which id the loaded data corresponds to, so stale renders show spinner
  const [loadedId, setLoadedId] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError('');

    if (id) {
      // Detail view
      let cancelled = false;
      const loadDetail = async () => {
        try {
          const pRes = await portfoliosApi.getById(id);
          if (cancelled) return;
          setPortfolio(pRes.data);

          const embedded = pRes.data.images;
          if (Array.isArray(embedded) && embedded.length > 0) {
            setImages(embedded);
          } else {
            const iRes = await portfoliosApi.getImages(id).catch(() => ({ data: { images: [] } }));
            if (cancelled) return;
            setImages(iRes.data.images || []);
          }
        } catch (err: any) {
          if (cancelled) return;
          setError(err.response?.data?.msg || 'Failed to load portfolio');
        } finally {
          if (!cancelled) {
            setLoading(false);
            setLoadedId(id);
          }
        }
      };
      loadDetail();
      return () => { cancelled = true; };
    } else {
      // List view
      setPortfolio(null);
      setImages([]);
      portfoliosApi.getAll()
        .then(res => {
          setPortfolios(res.data.portfolios || res.data || []);
        })
        .catch(err => setError(err.response?.data?.msg || 'Failed to load portfolios'))
        .finally(() => {
          setLoading(false);
          setLoadedId(null);
        });
    }
  }, [id]);

  const handleRemoveImage = async (imageId: string) => {
    if (!id || !confirm('Remove this image?')) return;
    setDeleting(imageId);
    try {
      await portfoliosApi.removeImage(id, imageId);
      const iRes = await portfoliosApi.getImages(id).catch(() => ({ data: { images: [] } }));
      setImages(iRes.data.images || []);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to remove image');
    } finally {
      setDeleting('');
    }
  };

  // Show spinner while loading or when route param doesn't match loaded data
  // This prevents stale-state flashes when React reuses the component across routes
  const idMismatch = (id ?? null) !== loadedId;
  if (loading || idMismatch) {
    return <LoadingSpinner message={id ? 'Loading portfolio...' : 'Loading portfolios...'} />;
  }

  // List view when no ID
  if (!id) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Portfolios</h1>
          {user?.role === 'photographer' && (
            <Link to="/portfolio/upload" className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">
              Create Portfolio
            </Link>
          )}
        </div>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
        {portfolios.length === 0 && !error ? (
          <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
            <p>No portfolios found.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {portfolios.map((p: any) => (
              <Link key={p._id} to={`/portfolios/${p._id}`} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
                <h3 className="font-semibold">{p.title}</h3>
                <p className="text-sm text-gray-600 mt-1 line-clamp-2">{p.description}</p>
                <div className="flex gap-2 mt-3">
                  <StatusBadge status={p.reviewStatus || 'pending'} />
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Detail view — error with navigation
  if (error) {
    return (
      <div>
        <div className="mb-4">
          <Link to="/portfolios" className="text-primary-600 hover:underline text-sm">&larr; Back to Portfolios</Link>
        </div>
        <div className="bg-red-50 text-red-600 p-4 rounded">{error}</div>
      </div>
    );
  }

  if (!portfolio) return <div className="text-gray-500">Portfolio not found.</div>;
  const isOwner = user?._id === portfolio.photographerId;

  return (
    <div>
      <div className="mb-4">
        <Link to="/portfolios" className="text-primary-600 hover:underline text-sm">&larr; Back to Portfolios</Link>
      </div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{portfolio.title}</h1>
          <p className="text-gray-600 text-sm mt-1">{portfolio.description}</p>
          <div className="flex gap-2 mt-2">
            <StatusBadge status={portfolio.reviewStatus || 'pending'} />
            {(portfolio.specialties || []).map((s: string) => (
              <span key={s} className="bg-gray-100 text-gray-700 text-xs px-2 py-0.5 rounded-full">{s}</span>
            ))}
          </div>
        </div>
        {isOwner && (
          <Link to={`/portfolios/${id}/upload`} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700">
            Add Images
          </Link>
        )}
      </div>

      {images.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center text-gray-500">
          <p>No images in this portfolio yet.</p>
          {isOwner && (
            <Link to={`/portfolios/${id}/upload`} className="text-primary-600 hover:underline text-sm mt-2 inline-block">
              Upload your first image
            </Link>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {images.map((img: any) => (
            <div key={img.id || img._id} className="bg-white rounded-lg shadow overflow-hidden group relative">
              <div className="aspect-square bg-gray-200 flex items-center justify-center">
                <img
                  src={img.previewUrl || img.url || '/placeholder.jpg'}
                  alt={img.caption || 'Portfolio image'}
                  className="w-full h-full object-cover"
                  onError={(e) => { (e.target as HTMLImageElement).src = ''; (e.target as HTMLImageElement).alt = 'Image'; }}
                />
              </div>
              <div className="p-3">
                {img.caption && <p className="text-sm text-gray-700 truncate">{img.caption}</p>}
                {img.copyrightNotice && <p className="text-xs text-gray-400 mt-1">{img.copyrightNotice}</p>}
              </div>
              {isOwner && (
                <button
                  onClick={() => handleRemoveImage(img.id || img._id)}
                  disabled={deleting === (img.id || img._id)}
                  className="absolute top-2 right-2 bg-red-600 text-white rounded-full w-6 h-6 text-xs opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                >
                  X
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
