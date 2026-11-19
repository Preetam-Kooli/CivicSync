import { Link } from 'react-router-dom';

export default function PublicShell({ children }) {
  return (
    <div className="min-h-dvh bg-slate-50">
      <header className="border-b border-slate-200 bg-white pt-[env(safe-area-inset-top)]">
        <div className="mx-auto flex min-h-14 max-w-5xl flex-wrap items-center justify-between gap-x-4 px-4">
          <Link to="/transparency" className="py-2 text-xl font-bold text-emerald-700">CivicSync</Link>
          <nav className="flex items-center gap-1" aria-label="Public">
            <Link to="/transparency" className="flex min-h-11 items-center rounded-lg px-3 hover:bg-slate-100">Transparency</Link>
            <Link to="/open-data" className="flex min-h-11 items-center rounded-lg px-3 hover:bg-slate-100">Open data</Link>
            <Link to="/login" className="flex min-h-11 items-center rounded-lg border border-slate-300 px-4 hover:bg-slate-100">Log in</Link>
          </nav>
        </div>
      </header>
      <main className="mx-auto max-w-5xl space-y-6 p-4 sm:p-8">{children}</main>
    </div>
  );
}