import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './useAuth.js';
import FullPageSpinner from '../shared/FullPageSpinner.jsx';

// Wraps a page. Remember: this is for user experience only. The server
// checks every API call again, so skipping this guard would gain nobody anything.
export default function RequireAuth({ portal, children }) {
  const { session, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullPageSpinner />;

  if (!session) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  // Logged in, but for the other portal: send them to their own area
  if (session.portal !== portal) {
    return <Navigate to={session.portal === 'admin' ? '/admin' : '/citizen'} replace />;
  }

  return children;
}