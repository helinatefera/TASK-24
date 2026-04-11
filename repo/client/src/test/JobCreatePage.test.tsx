import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import JobCreatePage from '../pages/JobCreatePage';

const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return { ...actual, useNavigate: () => mockNavigate };
});

vi.mock('../api/jobs.api', () => ({
  jobsApi: { create: vi.fn() },
}));
import { jobsApi } from '../api/jobs.api';

function renderPage() {
  return render(<MemoryRouter><JobCreatePage /></MemoryRouter>);
}

function field(label: string) { return screen.getByText(label).parentElement!.querySelector('input, select, textarea')!; }

describe('JobCreatePage', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('renders form with all required fields', () => {
    renderPage();
    expect(screen.getByText('Title *')).toBeInTheDocument();
    expect(screen.getByText('Description *')).toBeInTheDocument();
    expect(screen.getByText('Job Type *')).toBeInTheDocument();
    expect(screen.getByText('Rate Type *')).toBeInTheDocument();
    expect(screen.getByText('Agreed Rate ($) *')).toBeInTheDocument();
    expect(screen.getByText('Estimated Total ($) *')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /create job/i })).toBeInTheDocument();
  });

  it('converts dollar inputs to cents and submits', async () => {
    (jobsApi.create as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ data: { _id: 'job123' } });
    renderPage();

    fireEvent.change(field('Title *'), { target: { value: 'Wedding Photos' } });
    fireEvent.change(field('Description *'), { target: { value: 'Event photography' } });
    fireEvent.change(field('Agreed Rate ($) *'), { target: { value: '50.00' } });
    fireEvent.change(field('Estimated Total ($) *'), { target: { value: '200.50' } });
    fireEvent.click(screen.getByRole('button', { name: /create job/i }));

    await waitFor(() => {
      expect(jobsApi.create).toHaveBeenCalledWith(expect.objectContaining({
        title: 'Wedding Photos',
        description: 'Event photography',
        agreedRateCents: 5000,
        estimatedTotalCents: 20050,
        jobType: 'event',
        rateType: 'hourly',
      }));
      expect(mockNavigate).toHaveBeenCalledWith('/jobs/job123');
    });
  });

  it('shows server validation error', async () => {
    (jobsApi.create as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { data: { msg: 'Description too short' } },
    });
    renderPage();

    fireEvent.change(field('Title *'), { target: { value: 'Test Job' } });
    fireEvent.change(field('Description *'), { target: { value: 'D' } });
    fireEvent.change(field('Agreed Rate ($) *'), { target: { value: '10' } });
    fireEvent.change(field('Estimated Total ($) *'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /create job/i }));

    await waitFor(() => {
      expect(screen.getByText('Description too short')).toBeInTheDocument();
    });
  });

  it('allows selecting portrait job type and piece_rate', () => {
    renderPage();
    fireEvent.change(field('Job Type *'), { target: { value: 'portrait' } });
    fireEvent.change(field('Rate Type *'), { target: { value: 'piece_rate' } });
    expect((field('Job Type *') as HTMLSelectElement).value).toBe('portrait');
    expect((field('Rate Type *') as HTMLSelectElement).value).toBe('piece_rate');
  });

  it('shows rate type hint text based on selection', () => {
    renderPage();
    expect(screen.getByText(/per hour/i)).toBeInTheDocument();
    fireEvent.change(field('Rate Type *'), { target: { value: 'piece_rate' } });
    expect(screen.getByText(/per item/i)).toBeInTheDocument();
  });

  it('disables submit button while loading', async () => {
    (jobsApi.create as ReturnType<typeof vi.fn>).mockImplementation(() => new Promise(() => {}));
    renderPage();

    fireEvent.change(field('Title *'), { target: { value: 'T' } });
    fireEvent.change(field('Description *'), { target: { value: 'D' } });
    fireEvent.change(field('Agreed Rate ($) *'), { target: { value: '10' } });
    fireEvent.change(field('Estimated Total ($) *'), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /create job/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /creating/i })).toBeDisabled();
    });
  });
});
