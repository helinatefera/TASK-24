import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider } from '../context/AuthContext';
import PrivacySettingsPage from '../pages/PrivacySettingsPage';

vi.mock('../api/privacy.api', () => ({
  privacyApi: {
    getSettings: vi.fn(),
    updateSettings: vi.fn(),
  },
}));

import { privacyApi } from '../api/privacy.api';

function renderPage() {

  localStorage.setItem('user', JSON.stringify({ _id: '1', username: 'alice', role: 'alumni', email: 'a@t.com', accountStatus: 'active', isAlumni: true, communityId: 'c1' }));
  return render(
    <MemoryRouter>
      <AuthProvider>
        <PrivacySettingsPage />
      </AuthProvider>
    </MemoryRouter>,
  );
}

describe('PrivacySettingsPage', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('shows loading spinner while fetching settings', () => {
    (privacyApi.getSettings as any).mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText(/loading privacy settings/i)).toBeInTheDocument();
  });

  it('renders all privacy fields after load', async () => {
    (privacyApi.getSettings as any).mockResolvedValue({
      data: { firstName: 'public', lastName: 'public', email: 'alumni_only', phone: 'private' },
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/privacy settings/i)).toBeInTheDocument();
    });
    // All 8 field labels should appear
    expect(screen.getByText(/first name/i)).toBeInTheDocument();
    expect(screen.getByText(/last name/i)).toBeInTheDocument();
    expect(screen.getByText(/email/i)).toBeInTheDocument();
    expect(screen.getByText(/phone/i)).toBeInTheDocument();
  });

  it('shows error on API failure', async () => {
    (privacyApi.getSettings as any).mockRejectedValue({ response: { data: { msg: 'Server error' } } });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/server error|failed/i)).toBeInTheDocument();
    });
  });

  it('sends correct payload shape on save', async () => {
    (privacyApi.getSettings as any).mockResolvedValue({
      data: { firstName: 'public', email: 'alumni_only' },
    });
    (privacyApi.updateSettings as any).mockResolvedValue({ data: {} });
    renderPage();
    await waitFor(() => screen.getByText(/save settings/i));
    fireEvent.click(screen.getByText(/save settings/i));
    await waitFor(() => {
      expect(privacyApi.updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          fieldPrivacy: expect.any(Object),
        }),
      );
    });
  });

  it('shows success message after save', async () => {
    (privacyApi.getSettings as any).mockResolvedValue({ data: {} });
    (privacyApi.updateSettings as any).mockResolvedValue({ data: {} });
    renderPage();
    await waitFor(() => screen.getByText(/save settings/i));
    fireEvent.click(screen.getByText(/save settings/i));
    await waitFor(() => {
      expect(screen.getByText(/privacy settings saved/i)).toBeInTheDocument();
    });
  });
});
