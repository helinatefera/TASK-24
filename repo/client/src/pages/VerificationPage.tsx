import { useEffect, useState } from 'react';
import { verificationApi } from '../api/verification.api';
import FileUpload from '../components/shared/FileUpload';
import StatusBadge from '../components/shared/StatusBadge';
import LoadingSpinner from '../components/shared/LoadingSpinner';
import { formatDateTime } from '../utils/formatters';

export default function VerificationPage() {
  const [status, setStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [docType, setDocType] = useState('government_id');
  const [notes, setNotes] = useState('');
  const [realName, setRealName] = useState('');
  const [qualificationType, setQualificationType] = useState('general');
  const [issuingAuthority, setIssuingAuthority] = useState('');

  useEffect(() => {
    verificationApi.getStatus()
      .then(res => setStatus(res.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (files.length === 0) { setError('Please select a document to upload.'); return; }
    if (realName.trim().length < 2) { setError('Legal name is required (min 2 characters).'); return; }
    if (!qualificationType) { setError('Qualification type is required.'); return; }
    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      files.forEach(f => formData.append('documents', f));
      formData.append('documentType', docType);
      formData.append('realName', realName.trim());
      formData.append('qualificationType', qualificationType);
      if (issuingAuthority.trim()) formData.append('issuingAuthority', issuingAuthority.trim());
      formData.append('notes', notes);
      await verificationApi.submit(formData);
      setSuccess('Verification documents submitted successfully. You will be notified once reviewed.');
      setFiles([]);
      setNotes('');
      setRealName('');
      setIssuingAuthority('');
      const res = await verificationApi.getStatus();
      setStatus(res.data);
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Failed to submit verification');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <LoadingSpinner message="Loading verification status..." />;

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Identity Verification</h1>

      {status && (
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <h2 className="font-semibold mb-3">Current Status</h2>
          <div className="flex items-center gap-3">
            <StatusBadge status={status.status || 'not_submitted'} size="md" />
            {status.reviewedAt && <span className="text-sm text-gray-500">Reviewed: {formatDateTime(status.reviewedAt)}</span>}
          </div>
          {status.rejectionReason && (
            <div className="mt-3 bg-red-50 text-red-700 p-3 rounded text-sm">
              <strong>Rejection reason:</strong> {status.rejectionReason}
            </div>
          )}
          {status.submittedAt && (
            <p className="text-sm text-gray-500 mt-2">Submitted: {formatDateTime(status.submittedAt)}</p>
          )}
        </div>
      )}

      {(!status || status.status !== 'verified') && (
        <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow p-6 space-y-5">
          <h2 className="font-semibold">Submit Verification Documents</h2>
          {error && <div className="bg-red-50 text-red-600 p-3 rounded text-sm">{error}</div>}
          {success && <div className="bg-green-50 text-green-600 p-3 rounded text-sm">{success}</div>}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Legal Name <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={realName}
              onChange={e => setRealName(e.target.value)}
              required
              minLength={2}
              maxLength={200}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="Full legal name as shown on ID"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Qualification Type <span className="text-red-500">*</span></label>
            <select
              value={qualificationType}
              onChange={e => setQualificationType(e.target.value)}
              required
              className="w-full border rounded px-3 py-2 text-sm"
            >
              <option value="general">General</option>
              <option value="photography">Photography</option>
              <option value="videography">Videography</option>
              <option value="event">Event</option>
              <option value="portrait">Portrait</option>
              <option value="commercial">Commercial</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Issuing Authority</label>
            <input
              type="text"
              value={issuingAuthority}
              onChange={e => setIssuingAuthority(e.target.value)}
              maxLength={200}
              className="w-full border rounded px-3 py-2 text-sm"
              placeholder="e.g. State DMV, Alumni Office"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Document Type</label>
            <select value={docType} onChange={e => setDocType(e.target.value)} className="w-full border rounded px-3 py-2 text-sm">
              <option value="government_id">Government ID</option>
              <option value="passport">Passport</option>
              <option value="alumni_certificate">Alumni Certificate</option>
              <option value="drivers_license">Driver's License</option>
            </select>
          </div>

          <FileUpload
            onFilesSelected={setFiles}
            accept=".pdf,.jpg,.jpeg,.png"
            multiple={true}
            label="Documents"
            maxSizeMB={10}
          />

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Additional Notes</label>
            <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full border rounded px-3 py-2 text-sm" placeholder="Any additional information..." />
          </div>

          <button type="submit" disabled={submitting || files.length === 0 || realName.trim().length < 2} className="bg-primary-600 text-white px-6 py-2 rounded hover:bg-primary-700 disabled:opacity-50 text-sm">
            {submitting ? 'Submitting...' : 'Submit for Verification'}
          </button>
        </form>
      )}
    </div>
  );
}
