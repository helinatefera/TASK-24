import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

const links: Record<string, { to: string; label: string }[]> = {
  common: [
    { to: '/', label: 'Dashboard' },
    { to: '/profile/edit', label: 'My Profile' },
    { to: '/privacy', label: 'Privacy Settings' },
    { to: '/consent', label: 'Consent' },
    { to: '/access-requests', label: 'Access Requests' },
  ],
  alumni: [
    { to: '/jobs', label: 'Jobs' },
    { to: '/jobs/create', label: 'Create Job' },
    { to: '/photographer-directory', label: 'Photographers' },
    { to: '/reports/new', label: 'Report' },
  ],
  photographer: [
    { to: '/jobs', label: 'My Jobs' },
    { to: '/portfolios', label: 'Portfolio' },
    { to: '/portfolio/upload', label: 'Upload Portfolio' },
    { to: '/verification', label: 'Verification' },
    { to: '/reports/new', label: 'Report' },
  ],
  admin: [
    { to: '/admin', label: 'Admin Dashboard' },
    { to: '/admin/users', label: 'Users' },
    { to: '/admin/verification', label: 'Verification Review' },
    { to: '/admin/content-review', label: 'Content Review' },
    { to: '/admin/reports', label: 'Reports' },
    { to: '/admin/blacklist', label: 'Blacklist' },
    { to: '/admin/audit', label: 'Audit Logs' },
    { to: '/admin/content-filter', label: 'Content Filter' },
    { to: '/admin/privacy-policy', label: 'Privacy Policy' },
  ],
};

export default function Sidebar() {
  const { user } = useAuth();
  const location = useLocation();
  const role = user?.role || 'alumni';
  const navLinks = [...links.common, ...(links[role] || [])];

  return (
    <nav className="w-56 bg-gray-800 text-white min-h-screen p-4">
      <div className="mb-6 text-lg font-bold text-primary-500">LensWork</div>
      <ul className="space-y-1">
        {navLinks.map(link => (
          <li key={link.to}>
            <Link to={link.to} className={`block px-3 py-2 rounded text-sm ${location.pathname === link.to ? 'bg-gray-700 text-white' : 'text-gray-300 hover:bg-gray-700'}`}>
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
