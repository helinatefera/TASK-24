import { useEffect, useState } from 'react';
import { privacyApi } from '../api/privacy.api';
import LoadingSpinner from '../components/shared/LoadingSpinner';

const FIELDS = ['firstName', 'lastName', 'email', 'phone', 'location', 'employer', 'bio', 'graduationYear'];
const LEVELS = ['public', 'alumni_only', 'private'];

export default function PrivacySettingsPage() {
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    privacyApi.getSettings()
      .then(res => setSettings(res.data.fieldPrivacy || res.data || {}))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load settings'))
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSuccess('');
    try {
      await privacyApi.updateSettings({ fieldPrivacy: settings });
      setSuccess('Privacy settings saved.');
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading privacy settings..." />;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Privacy Settings</h1>
      <p className="text-sm text-gray-600 mb-4">
        Control who can see each field on your profile. "Public" means anyone, "Alumni Only" restricts to verified alumni, and "Private" hides the field entirely.
      </p>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}
      {success && <div className="bg-green-50 text-green-600 p-3 rounded mb-4 text-sm">{success}</div>}
      <div className="bg-white rounded-lg shadow divide-y">
        {FIELDS.map(field => (
          <div key={field} className="flex items-center justify-between px-6 py-4">
            <span className="text-sm font-medium text-gray-700 capitalize">
              {field.replace(/([A-Z])/g, ' $1').trim()}
            </span>
            <select
              value={settings[field] || 'public'}
              onChange={e => setSettings({ ...settings, [field]: e.target.value })}
              className="border rounded px-3 py-1.5 text-sm"
            >
              {LEVELS.map(l => (
                <option key={l} value={l}>{l.replace('_', ' ')}</option>
              ))}
            </select>
          </div>
        ))}
      </div>
      <div className="mt-6">
        <button onClick={handleSave} disabled={saving} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700 disabled:opacity-50 text-sm">
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </div>
  );
}
