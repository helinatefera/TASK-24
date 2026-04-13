import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { jobsApi } from '../api/jobs.api';
import { useAuth } from '../context/AuthContext';
import { formatCents, formatDate, formatDateTime } from '../utils/formatters';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import StatusBadge from '../components/shared/StatusBadge';
import MoneyDisplay from '../components/shared/MoneyDisplay';
import PasswordConfirmModal from '../components/shared/PasswordConfirmModal';

export default function JobDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [workEntries, setWorkEntries] = useState<any[]>([]);
  const [deliverables, setDeliverables] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [activeTab, setActiveTab] = useState<'details' | 'messages' | 'work' | 'deliverables'>('details');
  const [showAgreementModal, setShowAgreementModal] = useState(false);

  const fetchAll = async () => {
    if (!id) return;
    try {
      const [jobRes, msgRes, weRes, delRes] = await Promise.all([
        jobsApi.getById(id),
        jobsApi.getMessages(id).catch(() => ({ data: [] })),
        jobsApi.getWorkEntries(id).catch(() => ({ data: [] })),
        jobsApi.getDeliverables(id).catch(() => ({ data: [] })),
      ]);
      setJob(jobRes.data);
      setMessages(msgRes.data.items || msgRes.data || []);
      setWorkEntries(weRes.data.items || weRes.data || []);
      setDeliverables(delRes.data.items || delRes.data || []);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to load job');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!id || !newMessage.trim()) return;
    setSendingMsg(true);
    try {
      await jobsApi.sendMessage(id, newMessage.trim());
      setNewMessage('');
      const res = await jobsApi.getMessages(id);
      setMessages(res.data.items || res.data || []);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to send message');
    } finally {
      setSendingMsg(false);
    }
  };

  const handleAssign = async (photographerId: string) => {
    if (!id) return;
    try {
      await jobsApi.assign(id, photographerId);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to assign');
    }
  };

  const handleConfirmAgreement = async (password: string) => {
    if (!id) return;
    try {
      await jobsApi.confirmAgreement(id, password);
      setShowAgreementModal(false);
      await fetchAll();
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Agreement confirmation failed');
      throw err;
    }
  };

  if (loading) return <LoadingSpinner message="Loading job details..." />;
  if (error && !job) return <div className="bg-red-50 text-red-600 p-4 rounded">{error}</div>;
  if (!job) return <div className="text-gray-500">Job not found.</div>;

  const isClient = user?._id === job.clientId;
  const isPhotographer = user?._id === job.photographerId;

  const tabs = [
    { key: 'details', label: 'Details' },
    { key: 'messages', label: `Messages (${messages.length})` },
    { key: 'work', label: `Work Entries (${workEntries.length})` },
    { key: 'deliverables', label: `Deliverables (${deliverables.length})` },
  ] as const;

  return (
    <div>
      {error && <div className="bg-red-50 text-red-600 p-3 rounded mb-4 text-sm">{error}</div>}

      <div className="flex items-start justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">{job.title}</h1>
          <div className="flex gap-2 mt-2">
            <StatusBadge status={job.status} />
            <span className="text-sm text-gray-500 capitalize">{job.jobType}</span>
          </div>
        </div>
        <div className="flex gap-2">
          {isClient && (job.status === 'in_progress' || job.status === 'review') && (
            <Link to={`/jobs/${id}/timesheets`} className="border px-3 py-1.5 rounded text-sm hover:bg-gray-50">Timesheet</Link>
          )}
          {(isClient || isPhotographer) && job.status === 'assigned' && (
            <button onClick={() => setShowAgreementModal(true)} className="bg-green-600 text-white px-3 py-1.5 rounded text-sm hover:bg-green-700">Confirm Agreement</button>
          )}
          {isPhotographer && (
            <Link to={`/jobs/${id}/deliverables`} className="bg-primary-600 text-white px-3 py-1.5 rounded text-sm hover:bg-primary-700">Upload Deliverable</Link>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-4 border-b">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${activeTab === t.key ? 'border-primary-600 text-primary-700' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {activeTab === 'details' && (
        <div className="bg-white rounded-lg shadow">
          <dl className="divide-y">
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Description</dt>
              <dd className="text-sm text-gray-900 sm:col-span-2 whitespace-pre-wrap">{job.description}</dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Rate Type</dt>
              <dd className="text-sm text-gray-900 sm:col-span-2 capitalize">{job.rateType?.replace('_', ' ')}</dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Agreed Rate</dt>
              <dd className="sm:col-span-2"><MoneyDisplay cents={job.agreedRateCents || 0} /></dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Estimated Total</dt>
              <dd className="sm:col-span-2"><MoneyDisplay cents={job.estimatedTotalCents || 0} /></dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Created</dt>
              <dd className="text-sm text-gray-900 sm:col-span-2">{formatDate(job.createdAt)}</dd>
            </div>
            <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
              <dt className="text-sm font-medium text-gray-500">Client ID</dt>
              <dd className="text-sm text-gray-900 sm:col-span-2 font-mono text-xs">{job.clientId}</dd>
            </div>
            {job.photographerId && (
              <div className="px-6 py-4 sm:grid sm:grid-cols-3 sm:gap-4">
                <dt className="text-sm font-medium text-gray-500">Photographer ID</dt>
                <dd className="text-sm text-gray-900 sm:col-span-2 font-mono text-xs">{job.photographerId}</dd>
              </div>
            )}
          </dl>
          <div className="px-6 py-4 border-t flex gap-2">
            <Link to={`/jobs/${id}/timesheets`} className="text-primary-600 hover:underline text-sm">View Timesheet</Link>
            <Link to={`/jobs/${id}/escrow`} className="text-primary-600 hover:underline text-sm">View Escrow</Link>
          </div>
        </div>
      )}

      {activeTab === 'messages' && (
        <div className="bg-white rounded-lg shadow">
          <div className="max-h-96 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <p className="text-sm text-gray-500 text-center py-8">No messages yet.</p>
            ) : (
              messages.map((msg: any, i: number) => (
                <div key={msg._id || i} className={`flex ${msg.senderId === user?._id ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs px-4 py-2 rounded-lg text-sm ${msg.senderId === user?._id ? 'bg-primary-100 text-primary-900' : 'bg-gray-100 text-gray-900'}`}>
                    <p>{msg.messageText || msg.text}</p>
                    <p className="text-xs text-gray-400 mt-1">{formatDateTime(msg.createdAt || msg.timestamp)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
          <form onSubmit={handleSendMessage} className="border-t p-4 flex gap-2">
            <input
              type="text"
              value={newMessage}
              onChange={e => setNewMessage(e.target.value)}
              placeholder="Type a message..."
              className="flex-1 border rounded px-3 py-2 text-sm"
            />
            <button type="submit" disabled={sendingMsg || !newMessage.trim()} className="bg-primary-600 text-white px-4 py-2 rounded text-sm hover:bg-primary-700 disabled:opacity-50">
              {sendingMsg ? '...' : 'Send'}
            </button>
          </form>
        </div>
      )}

      {activeTab === 'work' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-sm">Work Entries</h3>
            {isPhotographer && <Link to={`/jobs/${id}/timesheets`} className="text-primary-600 text-sm hover:underline">Add Entry</Link>}
          </div>
          {workEntries.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No work entries yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead><tr className="border-b bg-gray-50"><th className="text-left px-6 py-3">Date</th><th className="text-left px-6 py-3">Type</th><th className="text-left px-6 py-3">Details</th><th className="text-right px-6 py-3">Subtotal</th></tr></thead>
              <tbody>
                {workEntries.map((we: any) => (
                  <tr key={we._id} className="border-b">
                    <td className="px-6 py-3">{we.date ? formatDate(we.date) : '-'}</td>
                    <td className="px-6 py-3 capitalize">{we.entryType?.replace('_', ' ')}</td>
                    <td className="px-6 py-3 text-gray-600">{we.entryType === 'time' ? `${we.durationMinutes || 0} min` : `${we.quantity || 0}x ${we.itemDescription || ''}`}</td>
                    <td className="px-6 py-3 text-right"><MoneyDisplay cents={we.subtotalCents || 0} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {activeTab === 'deliverables' && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b flex justify-between items-center">
            <h3 className="font-semibold text-sm">Deliverables</h3>
            {isPhotographer && <Link to={`/jobs/${id}/deliverables`} className="text-primary-600 text-sm hover:underline">Upload</Link>}
          </div>
          {deliverables.length === 0 ? (
            <p className="p-6 text-sm text-gray-500">No deliverables yet.</p>
          ) : (
            <div className="divide-y">
              {deliverables.map((d: any) => (
                <div key={d._id} className="px-6 py-4 flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{d.filename || d.originalName || 'File'}</p>
                    <p className="text-xs text-gray-500">{d.copyrightNotice || ''} - {formatDateTime(d.createdAt || d.uploadedAt)}</p>
                  </div>
                  {d.url && <a href={d.url} target="_blank" rel="noopener noreferrer" className="text-primary-600 text-sm hover:underline">Download</a>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <PasswordConfirmModal
        isOpen={showAgreementModal}
        onClose={() => setShowAgreementModal(false)}
        onConfirm={handleConfirmAgreement}
        title="Confirm Service Agreement"
        description="Enter your password to electronically confirm this service agreement. This action cannot be undone."
      />
    </div>
  );
}
