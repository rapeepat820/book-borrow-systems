import { Navigate } from 'react-router-dom';
import { getSession } from '../api';

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user } = getSession();
  if (!user) return <Navigate to={adminOnly ? '/admin/login' : '/login'} replace />;
  if (adminOnly && user.role !== 'admin') return <Navigate to="/admin/login" replace />;
  return children;
}
