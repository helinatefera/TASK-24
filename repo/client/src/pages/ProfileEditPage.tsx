import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { profilesApi } from '../api/profiles.api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const FIELDS = ['firstName', 'lastName', 'email', 'phone', 'location', 'employer', 'bio', 'graduationYear'] as const;
const PRIVACY_OPTIONS = ['public', 'alumni_only', 'private'];

export default function ProfileEditPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<Record<string, any>>({});
  const [privacy, setPrivacy] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    profilesApi.getMyProfile()
      .then(res => {
        const p = res.data;
        const formData: Record<string, any> = {};
        FIELDS.forEach(f => { formData[f] = p[f] || ''; });
        setForm(formData);
        setPrivacy(p.privacySettings || {});
      })
      .catch(err => setError(err.response?.data?.msg || 'Failed to load profile'))
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await profilesApi.updateProfile({ ...form, privacySettings: privacy });
      setSuccess('Profile updated successfully.');
      setTimeout(() => navigate('/profile/me'), 1000);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading profile..." />;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Edit Profile</h1>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
        {FIELDS.map(field => (
          <div key={field} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-start">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1 capitalize">
                {field.replace(/([A-Z])/g, ' $1').trim()}
              </label>
              {field === 'bio' ? (
                <textarea
                  value={form[field]}
                  onChange={e => setForm({ ...form, [field]: e.target.value })}
                  rows={3}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              ) : (
                <input
                  type={field === 'graduationYear' ? 'number' : field === 'email' ? 'email' : 'text'}
                  value={form[field]}
                  onChange={e => setForm({ ...form, [field]: e.target.value })}
                  className="w-full border rounded px-3 py-2 text-sm"
                />
              )}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-500 mb-1">Privacy</label>
              <select
                value={privacy[field] || 'public'}
                onChange={e => setPrivacy({ ...privacy, [field]: e.target.value })}
                className="w-full border rounded px-2 py-2 text-sm"
              >
                {PRIVACY_OPTIONS.map(opt => (
                  <option key={opt} value={opt}>{opt.replace('_', ' ')}</option>
                ))}
              </select>
            </div>
          </div>
        ))}
        <div className="flex gap-3 pt-4">
          <button type="submit" disabled={saving} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700 disabled:opacity-50 text-sm">
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="border px-6 py-2 rounded text-sm hover:bg-gray-50">
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
