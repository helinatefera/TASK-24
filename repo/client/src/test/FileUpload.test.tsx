import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import FileUpload from '../components/shared/FileUpload';
import DeliverableUploadPage from '../pages/DeliverableUploadPage';

// --- helpers -----------------------------------------------------------

function selectFiles(files: File[]) {
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  Object.defineProperty(input, 'files', { value: files, configurable: true });
  fireEvent.change(input);
}

function dropFiles(dropZone: HTMLElement, files: File[]) {
  const dataTransfer = { files, items: files.map(f => ({ kind: 'file', getAsFile: () => f })) };
  fireEvent.drop(dropZone, { dataTransfer });
}

function makeFile(name: string, type: string, sizeBytes?: number): File {
  const file = new File(['x'], name, { type });
  if (sizeBytes !== undefined) {
    Object.defineProperty(file, 'size', { value: sizeBytes });
  }
  return file;
}

// --- FileUpload component tests ----------------------------------------

describe('FileUpload component', () => {
  it('renders upload area with server validation note', () => {
    render(<FileUpload onFilesSelected={vi.fn()} />);
    expect(screen.getByText(/server validates/i)).toBeInTheDocument();
  });

  it('rejects files with invalid MIME type client-side', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const invalidFile = new File(['content'], 'malware.exe', { type: 'application/x-msdownload' });
    Object.defineProperty(input, 'files', { value: [invalidFile] });
    fireEvent.change(input);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });

  it('rejects files exceeding size limit', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} maxSizeMB={1} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    // Create a file object that reports 2MB size
    const bigFile = new File(['x'.repeat(100)], 'big.pdf', { type: 'application/pdf' });
    Object.defineProperty(bigFile, 'size', { value: 2 * 1024 * 1024 });
    Object.defineProperty(input, 'files', { value: [bigFile] });
    fireEvent.change(input);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
  });

  it('accepts valid PDF file', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} />);

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const validFile = new File(['%PDF-1.4'], 'document.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [validFile] });
    fireEvent.change(input);

    expect(onFilesSelected).toHaveBeenCalledWith([validFile]);
  });

  it('shows server validation message when server would reject', () => {
    render(<FileUpload onFilesSelected={vi.fn()} />);
    expect(screen.getByText(/MIME type, file size, and format signature/i)).toBeInTheDocument();
  });
});

// --- Rejection-path UI tests -------------------------------------------

describe('FileUpload rejection paths', () => {
  it('rejects invalid file via drag-and-drop', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} />);

    const dropZone = screen.getByText(/drag and drop/i).closest('div')!;
    const exe = makeFile('payload.exe', 'application/x-msdownload');
    dropFiles(dropZone, [exe]);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });

  it('rejects oversized file via drag-and-drop', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} maxSizeMB={5} />);

    const dropZone = screen.getByText(/drag and drop/i).closest('div')!;
    const big = makeFile('huge.png', 'image/png', 6 * 1024 * 1024);
    dropFiles(dropZone, [big]);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
  });

  it('rejects entire batch when one file has invalid type', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} multiple />);

    const good = makeFile('photo.png', 'image/png');
    const bad = makeFile('script.sh', 'application/x-sh');
    selectFiles([good, bad]);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();
  });

  it('rejects entire batch when one file exceeds size limit', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} multiple maxSizeMB={2} />);

    const small = makeFile('ok.pdf', 'application/pdf', 1 * 1024 * 1024);
    const oversized = makeFile('big.pdf', 'application/pdf', 3 * 1024 * 1024);
    selectFiles([small, oversized]);

    expect(onFilesSelected).not.toHaveBeenCalled();
    expect(screen.getByText(/file too large/i)).toBeInTheDocument();
  });

  it('clears error when a valid file is selected after rejection', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} />);

    // First: trigger rejection
    selectFiles([makeFile('bad.exe', 'application/x-msdownload')]);
    expect(screen.getByText(/invalid file type/i)).toBeInTheDocument();

    // Second: select valid file — error should clear
    selectFiles([makeFile('good.pdf', 'application/pdf')]);
    expect(screen.queryByText(/invalid file type/i)).not.toBeInTheDocument();
    expect(onFilesSelected).toHaveBeenCalledTimes(1);
  });

  it('removes a file from the selected list via Remove button', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} multiple />);

    const f1 = makeFile('a.pdf', 'application/pdf');
    const f2 = makeFile('b.png', 'image/png');
    selectFiles([f1, f2]);

    expect(screen.getByText(/a\.pdf/)).toBeInTheDocument();
    expect(screen.getByText(/b\.png/)).toBeInTheDocument();

    // Remove first file
    const removeButtons = screen.getAllByRole('button', { name: /remove/i });
    fireEvent.click(removeButtons[0]);

    expect(screen.queryByText(/a\.pdf/)).not.toBeInTheDocument();
    expect(screen.getByText(/b\.png/)).toBeInTheDocument();
    // onFilesSelected called once for initial selection + once for removal
    expect(onFilesSelected).toHaveBeenLastCalledWith([f2]);
  });

  it('accepts valid JPEG and PNG files', () => {
    const onFilesSelected = vi.fn();
    render(<FileUpload onFilesSelected={onFilesSelected} multiple />);

    const jpg = makeFile('photo.jpg', 'image/jpeg');
    const png = makeFile('screenshot.png', 'image/png');
    selectFiles([jpg, png]);

    expect(onFilesSelected).toHaveBeenCalledWith([jpg, png]);
    expect(screen.queryByText(/invalid file type/i)).not.toBeInTheDocument();
  });

  it('displays the offending filename in the error message', () => {
    render(<FileUpload onFilesSelected={vi.fn()} />);

    selectFiles([makeFile('evil_script.bat', 'application/x-msdos-program')]);

    expect(screen.getByText(/evil_script\.bat/)).toBeInTheDocument();
  });
});

// --- Server-side upload rejection handling (unit) ----------------------

describe('Server-side upload rejection handling (unit)', () => {
  it('server 400 rejection surfaces error to the user', async () => {
    const setError = vi.fn();
    const mockUpload = vi.fn().mockRejectedValue({
      response: { status: 400, data: { msg: 'Invalid PDF file format' } },
    });

    try {
      await mockUpload(new FormData());
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Upload failed');
    }

    expect(setError).toHaveBeenCalledWith('Invalid PDF file format');
  });

  it('server 400 for disallowed MIME type surfaces error', async () => {
    const setError = vi.fn();
    const mockUpload = vi.fn().mockRejectedValue({
      response: { status: 400, data: { msg: 'File type application/x-msdownload not allowed' } },
    });

    try {
      await mockUpload(new FormData());
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Upload failed');
    }

    expect(setError).toHaveBeenCalledWith('File type application/x-msdownload not allowed');
  });

  it('server 400 for oversized file surfaces error', async () => {
    const setError = vi.fn();
    const mockUpload = vi.fn().mockRejectedValue({
      response: { status: 400, data: { msg: 'File size 11534336 exceeds maximum 10485760 bytes (10MB)' } },
    });

    try {
      await mockUpload(new FormData());
    } catch (err: any) {
      setError(err.response?.data?.msg || 'Upload failed');
    }

    expect(setError).toHaveBeenCalledWith(expect.stringContaining('exceeds maximum'));
  });
});

// --- DeliverableUploadPage server rejection (component-level) ----------

vi.mock('../api/jobs.api', () => ({
  jobsApi: {
    uploadDeliverable: vi.fn(),
  },
}));

import { jobsApi } from '../api/jobs.api';

describe('DeliverableUploadPage server rejection', () => {

  function renderPage() {
    return render(
      <MemoryRouter initialEntries={['/jobs/job123/upload']}>
        <Routes>
          <Route path="/jobs/:jobId/upload" element={<DeliverableUploadPage />} />
        </Routes>
      </MemoryRouter>,
    );
  }

  it('shows server error when backend rejects file with invalid signature', async () => {
    (jobsApi.uploadDeliverable as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { status: 400, data: { msg: 'Invalid PDF file format' } },
    });

    renderPage();

    // Select a valid-looking file (passes client validation)
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const spoofed = new File(['not-actually-pdf'], 'fake.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [spoofed] });
    fireEvent.change(input);

    // Fill required copyright notice
    const copyrightInput = screen.getByPlaceholderText(/all rights reserved/i);
    fireEvent.change(copyrightInput, { target: { value: '(c) 2026 Test' } });

    // Submit the form
    const submitButton = screen.getByRole('button', { name: /upload/i });
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(screen.getByText('Invalid PDF file format')).toBeInTheDocument();
    });
  });

  it('shows server error when backend rejects disallowed MIME type', async () => {
    (jobsApi.uploadDeliverable as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { status: 400, data: { msg: 'File type text/html not allowed. Allowed: application/pdf, image/jpeg, image/png' } },
    });

    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const htmlFile = new File(['<html>'], 'page.pdf', { type: 'application/pdf' }); // spoofed extension
    Object.defineProperty(input, 'files', { value: [htmlFile] });
    fireEvent.change(input);

    fireEvent.change(screen.getByPlaceholderText(/all rights reserved/i), { target: { value: '(c) 2026 Test' } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/file type.*not allowed/i)).toBeInTheDocument();
    });
  });

  it('shows server error when backend rejects oversized file', async () => {
    (jobsApi.uploadDeliverable as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { status: 400, data: { msg: 'File size 11534336 exceeds maximum 10485760 bytes (10MB)' } },
    });

    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigFile = new File(['data'], 'huge.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [bigFile] });
    fireEvent.change(input);

    fireEvent.change(screen.getByPlaceholderText(/all rights reserved/i), { target: { value: '(c) 2026 Test' } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText(/exceeds maximum/i)).toBeInTheDocument();
    });
  });

  it('shows generic fallback message when server error has no msg field', async () => {
    (jobsApi.uploadDeliverable as ReturnType<typeof vi.fn>).mockRejectedValueOnce({
      response: { status: 500 },
    });

    renderPage();

    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['data'], 'doc.pdf', { type: 'application/pdf' });
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);

    fireEvent.change(screen.getByPlaceholderText(/all rights reserved/i), { target: { value: '(c) 2026 Test' } });
    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(screen.getByText('Failed to upload deliverable')).toBeInTheDocument();
    });
  });
});
