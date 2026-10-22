import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth.jsx';
import FullPageSpinner from './shared/FullPageSpinner.jsx';
import ComingSoon from './shared/ComingSoon.jsx';
import LoginPage from './pages/login/LoginPage.jsx';
import RegisterPage from './pages/register/RegisterPage.jsx';
import CitizenLayout from './portals/citizen/CitizenLayout.jsx';
import CitizenHome from './portals/citizen/CitizenHome.jsx';

// Loaded only when someone opens the admin area, so citizens never download it
const AdminHome = lazy(() => import('./portals/admin/AdminHome.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* One guarded layout, many pages inside it (they render in its <Outlet />) */}
      <Route
        path="/citizen"
        element={
          <RequireAuth portal="citizen">
            <CitizenLayout />
          </RequireAuth>
        }
      >
        <Route index element={<CitizenHome />} />
        <Route
          path="report"
          element={<ComingSoon title="Report an issue">Issue reporting with photo and map arrives in Phase 5.</ComingSoon>}
        />
        <Route
          path="reports"
          element={<ComingSoon title="My reports">Your reports and their progress will appear here.</ComingSoon>}
        />
      </Route>

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

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}