import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth.jsx';
import FullPageSpinner from './shared/FullPageSpinner.jsx';
import LoginPage from './pages/login/LoginPage.jsx';
import CitizenHome from './portals/citizen/CitizenHome.jsx';

const AdminHome = lazy(() => import('./portals/admin/AdminHome.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />

      <Route
        path="/citizen"
        element={
          <RequireAuth portal="citizen">
            <CitizenHome />
          </RequireAuth>
        }
      />

      <Route
        path="/admin"
        element={
          <RequireAuth portal="admin">
            <Suspense fallback={<FullPageSpinner />}>
              <AdminHome />
            </Suspense>
          </RequireAuth>
        }
      />

      {/* Anything else goes to the login page for now */}
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}