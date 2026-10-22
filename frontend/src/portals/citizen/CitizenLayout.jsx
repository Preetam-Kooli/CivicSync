import { useEffect, useState } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';

const LINKS = [
  { to: '/citizen', label: 'Home', end: true },
  { to: '/citizen/report', label: 'Report an issue' },
  { to: '/citizen/reports', label: 'My reports' },
];

// NavLink tells us whether the link matches the current page (isActive)
const linkClass = ({ isActive }) =>
  `flex min-h-11 items-center rounded-lg px-3 text-base font-medium ${
    isActive ? 'bg-emerald-50 text-emerald-700' : 'text-slate-700 hover:bg-slate-100'
  }`;

export default function CitizenLayout() {
  const { session, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // While the drawer is open: Escape closes it, and the page behind can't scroll
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

  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between gap-2 px-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setOpen(true)}
              aria-label="Open menu"
              aria-expanded={open}
              aria-controls="mobile-drawer"
              className="grid size-11 place-items-center rounded-lg hover:bg-slate-100 md:hidden"
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <span className="text-xl font-bold text-emerald-700">CivicSync</span>
          </div>

          {/* Desktop navigation: hidden on phones, shown from 768px up */}
          <nav className="hidden items-center gap-1 md:flex" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink key={l.to} to={l.to} end={l.end} className={linkClass}>
                {l.label}
              </NavLink>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {session.user.fullName}
            </span>
            <button
              type="button"
              onClick={() => logout()}
              className="min-h-11 rounded-lg border border-slate-300 px-4 text-base hover:bg-slate-100"
            >
              Log out
            </button>
          </div>
        </div>
      </header>

      {/* Phone drawer: always in the page, slid off-screen when closed.
          "invisible" also removes its links from the Tab order while closed. */}
      <div className="md:hidden">
        <div
          onClick={() => setOpen(false)}
          className={`fixed inset-0 z-40 bg-black/40 transition-opacity duration-200 ${
            open ? 'opacity-100' : 'pointer-events-none opacity-0'
          }`}
          aria-hidden="true"
        />
        <aside
          id="mobile-drawer"
          className={`fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col gap-1 bg-white p-4 pt-[calc(1rem+env(safe-area-inset-top))] shadow-xl transition-[transform,visibility] duration-200 ${
            open ? 'visible translate-x-0' : 'invisible -translate-x-full'
          }`}
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xl font-bold text-emerald-700">CivicSync</span>
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
          <nav className="flex flex-col gap-1" aria-label="Main">
            {LINKS.map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.end}
                className={linkClass}
                onClick={() => setOpen(false)}
              >
                {l.label}
              </NavLink>
            ))}
          </nav>
        </aside>
      </div>

      <main className="mx-auto max-w-5xl p-4 sm:p-8">
        <Outlet />
      </main>
    </div>
  );
}