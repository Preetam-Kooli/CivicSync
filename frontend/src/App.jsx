import { lazy, Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RequireAuth from './auth/RequireAuth.jsx';
import FullPageSpinner from './shared/FullPageSpinner.jsx';
import LoginPage from './pages/login/LoginPage.jsx';
import RegisterPage from './pages/register/RegisterPage.jsx';
import AcceptInvitePage from './pages/invite/AcceptInvitePage.jsx';
import CitizenLayout from './portals/citizen/CitizenLayout.jsx';
import CitizenHome from './portals/citizen/CitizenHome.jsx';

const TransparencyPage = lazy(() => import('./pages/public/TransparencyPage.jsx'));
const OpenDataPage = lazy(() => import('./pages/public/OpenDataPage.jsx'));

const ReportIssuePage = lazy(() => import('./portals/citizen/ReportIssuePage.jsx'));
const MyReportsPage = lazy(() => import('./portals/citizen/MyReportsPage.jsx'));
const ReportDetailPage = lazy(() => import('./portals/citizen/ReportDetailPage.jsx'));
const IssueMapPage = lazy(() => import('./shared/IssueMapPage.jsx'));

const AdminLayout = lazy(() => import('./portals/admin/AdminLayout.jsx'));
const AdminHome = lazy(() => import('./portals/admin/AdminHome.jsx'));
const IssuesPage = lazy(() => import('./portals/admin/IssuesPage.jsx'));
const IssueDetailPage = lazy(() => import('./portals/admin/IssueDetailPage.jsx'));
const AnalyticsPage = lazy(() => import('./portals/admin/AnalyticsPage.jsx'));
const HotspotsPage = lazy(() => import('./portals/admin/HotspotsPage.jsx'));
const UsersPage = lazy(() => import('./portals/admin/UsersPage.jsx'));
const InvitesPage = lazy(() => import('./portals/admin/InvitesPage.jsx'));

export default function App() {
  return (
    <>
      {/* Phase 8: the emergency banner goes here */}
      <Suspense fallback={<FullPageSpinner />}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/accept-invite" element={<AcceptInvitePage />} />
          <Route path="/transparency" element={<TransparencyPage />} />
          <Route path="/open-data" element={<OpenDataPage />} />

          <Route
            path="/citizen"
            element={
              <RequireAuth portal="citizen">
                <CitizenLayout />
              </RequireAuth>
            }
          >
            <Route index element={<CitizenHome />} />
            <Route path="report" element={<ReportIssuePage />} />
            <Route path="reports" element={<MyReportsPage />} />
            <Route path="reports/:id" element={<ReportDetailPage />} />
            <Route path="map" element={<IssueMapPage />} />
          </Route>

          <Route
            path="/admin"
            element={
              <RequireAuth portal="admin">
                <AdminLayout />
              </RequireAuth>
            }
          >
            <Route index element={<AdminHome />} />
            <Route path="issues" element={<IssuesPage />} />
            <Route path="issues/:id" element={<IssueDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="hotspots" element={<HotspotsPage />} />
            <Route path="map" element={<IssueMapPage detailPath={(id) => `/admin/issues/${id}`} />} />
            <Route path="users" element={<UsersPage />} />
            <Route path="invites" element={<InvitesPage />} />
          </Route>

          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </Suspense>
    </>
  );
}