import { useEffect, useState } from 'react';
import { adminApi } from '../../api/admin.api';
import LoadingSpinner from '../../components/shared/LoadingSpinner';

export default function ContentFilterConfigPage() {
  const [words, setWords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newWord, setNewWord] = useState('');
  const [newCategory, setNewCategory] = useState('general');
  const [adding, setAdding] = useState(false);
  const [deleting, setDeleting] = useState('');

  const fetchData = () => {
    setLoading(true);
    adminApi.getSensitiveWords()
      .then(res => setWords(res.data.items || res.data || []))
      .catch(err => setError(err.response?.data?.msg || 'Failed to load sensitive words'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchData(); }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWord.trim()) return;
    setAdding(true);
    setError('');
    try {
      await adminApi.addSensitiveWord({ word: newWord.trim(), category: newCategory });
      setNewWord('');
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to add word');
    } finally {
      setAdding(false);
    }
  };

  const handleRemove = async (id: string) => {
    if (!confirm('Remove this word from the filter?')) return;
    setDeleting(id);
    try {
      await adminApi.removeSensitiveWord(id);
      fetchData();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to remove word');
    } finally {
      setDeleting('');
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Content Filter Configuration</h1>
      <p className="text-sm text-gray-600 mb-4">
        Manage the list of sensitive words used to automatically flag content for review.
      </p>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <form onSubmit={handleAdd} className="bg-white rounded-lg shadow p-4 mb-6">
        <div className="flex gap-3">
          <input
            type="text"
            value={newWord}
            onChange={e => setNewWord(e.target.value)}
            placeholder="Add a sensitive word..."
            required
            className="flex-1 border rounded px-3 py-2 text-sm"
          />
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)} className="border rounded px-3 py-2 text-sm">
            <option value="general">General</option>
            <option value="profanity">Profanity</option>
            <option value="harassment">Harassment</option>
            <option value="discrimination">Discrimination</option>
            <option value="spam">Spam</option>
          </select>
          <button type="submit" disabled={adding} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 disabled:opacity-50">
            {adding ? 'Adding...' : 'Add'}
          </button>
        </div>
      </form>

      {loading ? (
        <LoadingSpinner message="Loading sensitive words..." />
      ) : words.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500">No sensitive words configured.</div>
      ) : (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-sm">Sensitive Words ({words.length})</h2>
          </div>
          <div className="divide-y">
            {words.map((entry: any) => (
              <div key={entry._id} className="flex items-center justify-between px-6 py-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono">{entry.word}</span>
                  <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded capitalize">{entry.category || 'general'}</span>
                </div>
                <button
                  onClick={() => handleRemove(entry._id)}
                  disabled={deleting === entry._id}
                  className="text-red-600 hover:underline text-xs disabled:opacity-50"
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
