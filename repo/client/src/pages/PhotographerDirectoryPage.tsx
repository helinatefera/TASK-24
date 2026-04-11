import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { profilesApi } from '../api/profiles.api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

export default function PhotographerDirectoryPage() {
  const [photographers, setPhotographers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [locationFilter, setLocationFilter] = useState('');

  useEffect(() => {
    profilesApi.getProfiles({ role: 'photographer' })
      .then(res => setPhotographers(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load photographers'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <LoadingSpinner message="Loading photographers..." />;

  const filtered = photographers.filter(p => {
    const name = `${p.firstName || ''} ${p.lastName || ''} ${p.username || ''}`.toLowerCase();
    const matchSearch = !search || name.includes(search.toLowerCase());
    const matchLocation = !locationFilter || (p.location || '').toLowerCase().includes(locationFilter.toLowerCase());
    return matchSearch && matchLocation;
  });

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Photographer Directory</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="flex gap-4 mb-6">
        <input
          type="text"
          placeholder="Search by name..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 border rounded px-3 py-2 text-sm"
        />
        <input
          type="text"
          placeholder="Filter by location..."
          value={locationFilter}
          onChange={e => setLocationFilter(e.target.value)}
          className="w-48 border rounded px-3 py-2 text-sm"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No photographers found.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(p => (
            <div key={p._id || p.userId} className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {p.firstName || p.username || 'Photographer'} {p.lastName || ''}
                  </h3>
                  {p.location && <p className="text-sm text-gray-500 mt-1">{p.location}</p>}
                </div>
                <div className="w-10 h-10 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-sm font-bold">
                  {(p.firstName || p.username || '?')[0].toUpperCase()}
                </div>
              </div>
              {p.bio && <p className="text-sm text-gray-600 mt-3 line-clamp-2">{p.bio}</p>}
              <div className="mt-4 flex gap-2">
                <Link to={`/profile/${p.userId || p._id}`} className="text-primary-600 hover:underline text-sm">
                  View Profile
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
