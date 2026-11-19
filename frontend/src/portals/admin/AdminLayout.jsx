import { Suspense, useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { ROLE_LABELS } from './constants.js';

const LINKS = [
  { to: '/admin', label: 'Dashboard', end: true },
  { to: '/admin/issues', label: 'Issues' },
  { to: '/admin/map', label: 'Map' },
  { to: '/admin/analytics', label: 'Analytics' },
  { to: '/admin/hotspots', label: 'Hotspots' },
  { to: '/admin/alerts', label: 'Alerts', notStaff: true },
  { to: '/admin/users', label: 'Users', superOnly: true },
  { to: '/admin/invites', label: 'Invitations', superOnly: true },
];

const linkClass = ({ isActive }) =>
  `flex min-h-11 items-center rounded-lg px-3 text-base font-medium ${
    isActive ? 'bg-amber-50 text-amber-800' : 'text-slate-700 hover:bg-slate-100'
  }`;

export default function AdminLayout() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Only SHOW links the user may use. The server enforces it regardless.
    const links = LINKS.filter(
    (l) => (!l.superOnly || session.user.role === 'super_admin') && (!l.notStaff || session.user.role !== 'staff')
  );
  // While the phone drawer is open: Escape closes it, and the page behind can't scroll
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [open]);

  const nav = (onNavigate) => (
    <nav className="flex flex-col gap-1" aria-label="Admin">
      {links.map((l) => (
        <NavLink key={l.to} to={l.to} end={l.end} className={linkClass} onClick={onNavigate}>
          {l.label}
        </NavLink>
      ))}
    </nav>
  );

  const who = (
    <div className="text-sm">
      <p className="font-medium text-slate-800">{session.user.fullName}</p>
      <p className="text-slate-500">{ROLE_LABELS[session.user.role] || session.user.role}</p>
    </div>
  );

  const logoutButton = (
    <button
      type="button"
      onClick={() => logout()}
      className="min-h-11 w-full rounded-lg border border-slate-300 px-4 text-base hover:bg-slate-100"
    >
      Log out
    </button>
  );

  return (
    <div className="min-h-dvh bg-slate-50 md:flex">
      {/* Desktop sidebar (hidden on phones) */}
      <aside className="hidden w-60 shrink-0 flex-col gap-6 border-r border-slate-200 bg-white p-4 md:flex">
        <span className="px-3 text-xl font-bold text-amber-700">CivicSync Admin</span>
        {nav()}
        <div className="mt-auto space-y-3 px-1">
          {who}
          {logoutButton}
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        {/* Phone top bar (hidden from 768px up) */}
        <header className="sticky top-0 z-30 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)] md:hidden">
          <div className="flex h-14 items-center gap-1 px-4">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="admin-drawer"
              className="grid size-11 place-items-center rounded-lg hover:bg-slate-100"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-xl font-bold text-amber-700">CivicSync Admin</span>
          </div>
        </header>

        {/* Phone drawer, slid off-screen when closed. "invisible" also removes its
            links from the Tab order while closed. */}
        <div className="md:hidden">
          <div
            onClick={() => setOpen(false)}
            className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
              open ? 'opacity-100' : 'pointer-events-none opacity-0'
            }`}
            aria-hidden="true"
          />
          <aside
            id="admin-drawer"
            className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-4 bg-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] shadow-xl transition-[transform,visibility] duration-200 ${
              open ? 'visible translate-x-0' : 'invisible -translate-x-full'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xl font-bold text-amber-700">CivicSync Admin</span>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close menu"
                className="grid size-11 place-items-center rounded-lg hover:bg-slate-100"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
            {nav(() => setOpen(false))}
            <div className="mt-auto space-y-3">
              {who}
              {logoutButton}
            </div>
          </aside>
        </div>

        <main className="mx-auto max-w-5xl p-4 sm:p-8">
          <Suspense fallback={<p className="text-slate-500">Loading…</p>}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}