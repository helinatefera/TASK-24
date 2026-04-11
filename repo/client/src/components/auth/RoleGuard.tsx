import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function RoleGuard({ roles }: { roles: string[] }) {
  const { user } = useAuth();
  if (!user || !roles.includes(user.role)) {
    return <div className="p-8 text-center"><h2 className="text-xl font-bold text-red-600">Access Denied</h2><p>You do not have permission to view this page.</p></div>;
  }
  return <Outlet />;
}
