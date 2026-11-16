import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth.jsx';
import FullPageSpinner from './shared/FullPageSpinner.jsx';
import ComingSoon from './shared/ComingSoon.jsx';
import LoginPage from './pages/login/LoginPage.jsx';
import RegisterPage from './pages/register/RegisterPage.jsx';
import AcceptInvitePage from './pages/invite/AcceptInvitePage.jsx';
import CitizenLayout from './portals/citizen/CitizenLayout.jsx';
import CitizenHome from './portals/citizen/CitizenHome.jsx';

// Loaded only when someone opens the admin area, so citizens never download it
const AdminLayout = lazy(() => import('./portals/admin/AdminLayout.jsx'));
const AdminHome = lazy(() => import('./portals/admin/AdminHome.jsx'));
const UsersPage = lazy(() => import('./portals/admin/UsersPage.jsx'));
const InvitesPage = lazy(() => import('./portals/admin/InvitesPage.jsx'));

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/accept-invite" element={<AcceptInvitePage />} />

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
              <AdminLayout />
            </Suspense>
          </RequireAuth>
        }
      >
        <Route index element={<AdminHome />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="invites" element={<InvitesPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  );
}