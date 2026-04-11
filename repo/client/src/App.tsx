import { Routes, Route } from 'react-router-dom';
import ProtectedRoute from './components/auth/ProtectedRoute';
import RoleGuard from './components/auth/RoleGuard';
import AppShell from './components/layout/AppShell';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProfilePage from './pages/ProfilePage';
import ProfileEditPage from './pages/ProfileEditPage';
import PrivacySettingsPage from './pages/PrivacySettingsPage';
import ConsentManagementPage from './pages/ConsentManagementPage';
import PrivacyPolicyHistoryPage from './pages/PrivacyPolicyHistoryPage';
import AccessRequestsPage from './pages/AccessRequestsPage';
import PortfolioPage from './pages/PortfolioPage';
import PortfolioUploadPage from './pages/PortfolioUploadPage';
import PhotographerDirectoryPage from './pages/PhotographerDirectoryPage';
import VerificationPage from './pages/VerificationPage';
import JobListPage from './pages/JobListPage';
import JobDetailPage from './pages/JobDetailPage';
import JobCreatePage from './pages/JobCreatePage';
import TimesheetPage from './pages/TimesheetPage';
import SettlementListPage from './pages/SettlementListPage';
import SettlementDetailPage from './pages/SettlementDetailPage';
import PaymentRecordPage from './pages/PaymentRecordPage';
import EscrowLedgerPage from './pages/EscrowLedgerPage';
import DeliverableUploadPage from './pages/DeliverableUploadPage';
import ReportCreatePage from './pages/ReportCreatePage';
import ReportListPage from './pages/ReportListPage';
import AdminDashboardPage from './pages/admin/AdminDashboardPage';
import UserManagementPage from './pages/admin/UserManagementPage';
import VerificationReviewPage from './pages/admin/VerificationReviewPage';
import ContentReviewPage from './pages/admin/ContentReviewPage';
import ReportManagementPage from './pages/admin/ReportManagementPage';
import BlacklistPage from './pages/admin/BlacklistPage';
import AuditLogPage from './pages/admin/AuditLogPage';
import ContentFilterConfigPage from './pages/admin/ContentFilterConfigPage';
import PrivacyPolicyEditorPage from './pages/admin/PrivacyPolicyEditorPage';
import NotFoundPage from './pages/NotFoundPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/profile/:id" element={<ProfilePage />} />
          <Route path="/profile/edit" element={<ProfileEditPage />} />
          <Route path="/privacy" element={<PrivacySettingsPage />} />
          <Route path="/consent" element={<ConsentManagementPage />} />
          <Route path="/consent/history" element={<PrivacyPolicyHistoryPage />} />
          <Route path="/access-requests" element={<AccessRequestsPage />} />
          <Route path="/portfolios" element={<PortfolioPage />} />
          <Route path="/portfolios/:id" element={<PortfolioPage />} />
          <Route path="/portfolios/:id/upload" element={<PortfolioUploadPage />} />
          <Route path="/portfolio/upload" element={<PortfolioUploadPage />} />
          <Route path="/photographer-directory" element={<PhotographerDirectoryPage />} />
          <Route path="/verification" element={<VerificationPage />} />
          <Route path="/jobs" element={<JobListPage />} />
          <Route path="/jobs/create" element={<JobCreatePage />} />
          <Route path="/jobs/:id" element={<JobDetailPage />} />
          <Route path="/jobs/:jobId/timesheets" element={<TimesheetPage />} />
          <Route path="/jobs/:jobId/escrow" element={<EscrowLedgerPage />} />
          <Route path="/jobs/:jobId/deliverables" element={<DeliverableUploadPage />} />
          <Route path="/settlements" element={<SettlementListPage />} />
          <Route path="/settlements/:id" element={<SettlementDetailPage />} />
          <Route path="/settlements/:id/pay" element={<PaymentRecordPage />} />
          <Route path="/reports/new" element={<ReportCreatePage />} />
          <Route path="/reports" element={<ReportListPage />} />
          <Route element={<RoleGuard roles={['admin']} />}>
            <Route path="/admin" element={<AdminDashboardPage />} />
            <Route path="/admin/users" element={<UserManagementPage />} />
            <Route path="/admin/verification" element={<VerificationReviewPage />} />
            <Route path="/admin/content-review" element={<ContentReviewPage />} />
            <Route path="/admin/reports" element={<ReportManagementPage />} />
            <Route path="/admin/blacklist" element={<BlacklistPage />} />
            <Route path="/admin/audit" element={<AuditLogPage />} />
            <Route path="/admin/content-filter" element={<ContentFilterConfigPage />} />
            <Route path="/admin/privacy-policy" element={<PrivacyPolicyEditorPage />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
