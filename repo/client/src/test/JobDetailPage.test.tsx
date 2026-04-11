import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import JobDetailPage from '../pages/JobDetailPage';

vi.mock('../api/jobs.api', () => ({
  jobsApi: {
    getById: vi.fn(),
    getMessages: vi.fn(),
    getWorkEntries: vi.fn(),
    getDeliverables: vi.fn(),
    sendMessage: vi.fn(),
    confirmAgreement: vi.fn(),
  },
}));
import { jobsApi } from '../api/jobs.api';

const mockUser = { _id: 'client1', role: 'alumni', isAlumni: true };
vi.mock('../context/AuthContext', () => ({
  useAuth: () => ({ user: mockUser }),
}));

const JOB = {
  _id: 'job1', title: 'Wedding Photography', description: 'Photos for the ceremony',
  status: 'assigned', jobType: 'event', rateType: 'hourly', agreedRateCents: 5000,
  estimatedTotalCents: 20000, clientId: 'client1', photographerId: 'phot1', createdAt: '2026-01-01',
};

function setupApi(overrides: any = {}) {
  const job = { ...JOB, ...overrides };
  (jobsApi.getById as ReturnType<typeof vi.fn>).mockResolvedValue({ data: job });
  (jobsApi.getMessages as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  (jobsApi.getWorkEntries as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
  (jobsApi.getDeliverables as ReturnType<typeof vi.fn>).mockResolvedValue({ data: [] });
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={['/jobs/job1']}>
      <Routes>
        <Route path="/jobs/:id" element={<JobDetailPage />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('JobDetailPage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders job title and status after loading', async () => {
    setupApi();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Wedding Photography')).toBeInTheDocument();
      expect(screen.getByText(/assigned/i)).toBeInTheDocument();
    });
  });

  it('shows error when API fails', async () => {
    (jobsApi.getById as ReturnType<typeof vi.fn>).mockRejectedValue({
      response: { data: { msg: 'Job not found' } },
    });
    (jobsApi.getMessages as ReturnType<typeof vi.fn>).mockRejectedValue({});
    (jobsApi.getWorkEntries as ReturnType<typeof vi.fn>).mockRejectedValue({});
    (jobsApi.getDeliverables as ReturnType<typeof vi.fn>).mockRejectedValue({});
    renderPage();
    await waitFor(() => {
      expect(screen.getByText('Job not found')).toBeInTheDocument();
    });
  });

  it('renders 4 tabs: Details, Messages, Work Entries, Deliverables', async () => {
    setupApi();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /details/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /messages/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /work entries/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /deliverables/i })).toBeInTheDocument();
    });
  });

  it('switches to messages tab and shows empty state', async () => {
    setupApi();
    renderPage();
    await waitFor(() => screen.getByText('Wedding Photography'));

    fireEvent.click(screen.getByRole('button', { name: /messages/i }));
    expect(screen.getByText(/no messages yet/i)).toBeInTheDocument();
  });

  it('switches to work tab and shows empty state', async () => {
    setupApi();
    renderPage();
    await waitFor(() => screen.getByText('Wedding Photography'));

    fireEvent.click(screen.getByRole('button', { name: /work entries/i }));
    expect(screen.getByText(/no work entries yet/i)).toBeInTheDocument();
  });

  it('shows Confirm Agreement button when job is assigned and user is client', async () => {
    setupApi({ status: 'assigned' });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /confirm agreement/i })).toBeInTheDocument();
    });
  });

  it('does not show Confirm Agreement for completed jobs', async () => {
    setupApi({ status: 'completed' });
    renderPage();
    await waitFor(() => screen.getByText('Wedding Photography'));
    expect(screen.queryByRole('button', { name: /confirm agreement/i })).not.toBeInTheDocument();
  });

  it('sends message via messages tab', async () => {
    setupApi();
    (jobsApi.sendMessage as ReturnType<typeof vi.fn>).mockResolvedValueOnce({});
    (jobsApi.getMessages as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ data: [] })
      .mockResolvedValueOnce({ data: [{ _id: 'm1', senderId: 'client1', messageText: 'Hello', createdAt: '2026-01-01' }] });

    renderPage();
    await waitFor(() => screen.getByText('Wedding Photography'));

    fireEvent.click(screen.getByRole('button', { name: /messages/i }));
    fireEvent.change(screen.getByPlaceholderText(/type a message/i), { target: { value: 'Hello' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => {
      expect(jobsApi.sendMessage).toHaveBeenCalledWith('job1', 'Hello');
    });
  });

  it('shows details tab content with rate and description', async () => {
    setupApi();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/photos for the ceremony/i)).toBeInTheDocument();
      expect(screen.getByText(/hourly/i)).toBeInTheDocument();
    });
  });

  it('shows Timesheet link for client on in_progress job', async () => {
    setupApi({ status: 'in_progress' });
    renderPage();
    await waitFor(() => {
      const links = screen.getAllByRole('link', { name: /timesheet/i });
      expect(links.length).toBeGreaterThanOrEqual(1);
    });
  });
});
