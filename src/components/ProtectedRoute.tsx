import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

type ProtectedRouteProps = {
  allowedRoles?: ('nanny' | 'agency_admin' | 'agency_recruiter' | 'superadmin' | 'family')[];
};

export default function ProtectedRoute({ allowedRoles }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-600"></div>
      </div>
    );
  }

  // If not logged in, redirect to login
  if (!user) {
    return <Navigate to="/login" replace />;
  }

  // If roles are specified and user's role doesn't match, redirect to their respective dashboard
  if (allowedRoles && role && !allowedRoles.includes(role)) {
    if (role === 'nanny') return <Navigate to="/nanny/dashboard" replace />;
    if (role === 'agency_admin' || role === 'agency_recruiter') return <Navigate to="/agency/dashboard" replace />;
    if (role === 'superadmin') return <Navigate to="/admin/dashboard" replace />;
    if (role === 'family') return <Navigate to="/family/dashboard" replace />;
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}
