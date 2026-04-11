import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { profilesApi } from '../api/profiles.api';
import { useAuth } from '../context/AuthContext';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';

export default function ProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchProfile = id && id !== 'me'
      ? profilesApi.getProfile(id)
      : profilesApi.getMyProfile();
    fetchProfile
      .then(res => setProfile(res.data))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <LoadingSpinner message="Loading profile..." />;
  if (error) return <div className="bg-red-50 text-red-600 p-4 rounded">{error}</div>;
  if (!profile) return <div className="text-gray-500">Profile not found.</div>;

  const isOwn = !id || id === 'me' || id === user?._id;
  const privacy = profile.privacySettings || {};

  const maskValue = (field: string, value: any) => {
    if (isOwn) return value || '-';
    const level = privacy[field];
    if (level === 'alumni_only' && !user?.isAlumni) return '(Alumni only)';
    if (level === 'private') {
      if (!value) return '-';
      const s = String(value);
      if (field === 'phone' && s.length >= 7) return `(${s.slice(0, 3)}) ***-${s.slice(-4)}`;
      if (field === 'phone') return `(***) ***-${s.slice(-4)}`;
      if (field === 'email' && s.includes('@')) {
        const [local, domain] = s.split('@');
        return `${local[0]}***@${domain}`;
      }
      if (field === 'employer') return `${s[0]}${'*'.repeat(Math.min(s.length - 1, 8))}`;
      return '******';
    }
    return value || '-';
  };

  const fields = [
    { label: 'First Name', key: 'firstName' },
    { label: 'Last Name', key: 'lastName' },
    { label: 'Email', key: 'email' },
    { label: 'Phone', key: 'phone' },
    { label: 'Location', key: 'location' },
    { label: 'Employer', key: 'employer' },
    { label: 'Bio', key: 'bio' },
    { label: 'Graduation Year', key: 'graduationYear' },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">
          {isOwn ? 'My Profile' : `${profile.firstName || ''} ${profile.lastName || ''}`.trim() || 'Profile'}
        </h1>
        {isOwn && (
          <Link to="/profile/edit" className="bg-primary-600 text-white px-4 py-2 rounded hover:bg-primary-700 text-sm">
            Edit Profile
          </Link>
        )}
      </div>
      <div className="bg-white rounded-lg shadow">
        <dl className="divide-y">
          {fields.map(f => (
            <div key={f.key} className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">{f.label}</dt>
              <dd className="mt-1 text-sm text-gray-900 sm:col-span-2 sm:mt-0">
                {maskValue(f.key, profile[f.key])}
                {!isOwn && privacy[f.key] && privacy[f.key] !== 'public' && (
                  <StatusBadge status={privacy[f.key]} size="sm" />
                )}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
