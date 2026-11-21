import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Moon, Plus, Search, Settings, Sun } from 'lucide-react';
import { useAuth } from '../auth/useAuth.js';
import { useTheme } from '../theme/useTheme.js';
import { api } from '../lib/api.js';
import Logo from '../ui/Logo.jsx';
import Button from '../ui/Button.jsx';
import { Avatar, Skeleton } from '../ui/Surface.jsx';
import { Menu, MenuItem, Modal } from '../ui/Overlay.jsx';
import AlertBanner from '../shared/AlertBanner.jsx';
import { ROLE_LABELS } from '../portals/admin/constants.js';
import { ShellContext } from './shellContext.js';
import { PORTALS, isVisible } from './nav.js';
import SearchBox from './SearchBox.jsx';

function Notifications({ summary }) {
  const [alerts, setAlerts] = useState([]);
  useEffect(() => {
    let off = false;
    const load = () => api('GET', '/api/public/alerts').then((d) => { if (!off) setAlerts(d.alerts); }).catch(() => {});
    load();
    const id = setInterval(load, 120000);
    return () => { off = true; clearInterval(id); };
  }, []);
  const overdue = summary?.counts.overdue ?? 0;
  const toVerify = summary?.counts.toVerify ?? 0;

  return (
    <Menu button={({ toggle }) => (
      <button type="button" onClick={toggle} aria-label="Notifications" className="relative grid size-11 place-items-center rounded-xl text-slate-600 hover:bg-slate-100">
        <Bell size={20} />
        {(alerts.length > 0 || overdue > 0) && <span className="absolute right-2.5 top-2.5 size-2 rounded-full bg-red-500 ring-2 ring-[var(--card)]" />}
      </button>
    )}>
      <div className="w-72 p-1 sm:w-80">
        <p className="px-2 pb-2 text-sm font-semibold text-slate-800">Notifications</p>
        {overdue > 0 && <Link to="/admin/issues" className="block rounded-xl px-2 py-2 text-sm hover:bg-slate-100"><b className="text-red-600">{overdue}</b> issues are past their deadline</Link>}
        {toVerify > 0 && <Link to="/admin/issues?status=reported" className="block rounded-xl px-2 py-2 text-sm hover:bg-slate-100"><b>{toVerify}</b> new reports need verification</Link>}
        {alerts.map((a) => (
          <div key={a.id} className="rounded-xl px-2 py-2 text-sm">
            <p className="font-semibold text-slate-800">{a.title}</p>
            <p className="text-xs text-slate-500">{a.message}</p>
          </div>
        ))}
        {alerts.length === 0 && overdue === 0 && toVerify === 0 && <p className="px-2 py-4 text-center text-sm text-slate-500">You're all caught up.</p>}
      </div>
    </Menu>
  );
}

function UserMenu({ user, onLogout, settingsTo }) {
  const { dark, setTheme } = useTheme();
  const navigate = useNavigate();
  return (
    <Menu button={({ toggle }) => (
      <button type="button" onClick={toggle} aria-label="Account menu" className="rounded-full"><Avatar name={user.fullName} size={40} /></button>
    )}>
      <div className="px-3 py-2">
        <p className="truncate text-sm font-semibold text-slate-800">{user.fullName}</p>
        <p className="truncate text-xs text-slate-500">{user.email}</p>
      </div>
      <MenuItem icon={Settings} onClick={() => navigate(settingsTo)}>Settings</MenuItem>
      <MenuItem icon={dark ? Sun : Moon} onClick={() => setTheme(dark ? 'light' : 'dark')}>{dark ? 'Light theme' : 'Dark theme'}</MenuItem>
      <MenuItem icon={LogOut} danger onClick={onLogout}>Log out</MenuItem>
    </Menu>
  );
}

const Tab = ({ to, label, icon: Icon, end }) => (
  <NavLink to={to} end={end} className={({ isActive }) => `flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold ${isActive ? 'text-brand-600' : 'text-slate-400'}`}>
    <Icon size={22} />
    {label}
  </NavLink>
);

export default function AppShell({ portal }) {
  const cfg = PORTALS[portal];
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const user = session.user;
  const isAdmin = portal === 'admin';
  const [summary, setSummary] = useState(null);
  const [meta, setMeta] = useState({ path: '', title: '', subtitle: '' });
  const [sheet, setSheet] = useState(null); // 'more' | 'new'
  const searchRef = useRef(null);

  useEffect(() => {
    if (!isAdmin) return;
    let off = false;
    api('GET', '/api/admin/summary').then((d) => { if (!off) setSummary(d); }).catch(() => {});
    return () => { off = true; };
  }, [isAdmin, pathname]); // refreshed on every navigation, so counts stay current

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const groups = cfg.groups
    .map((g) => ({ ...g, items: g.items.filter((i) => isVisible(i, user.role)) }))
    .filter((g) => g.items.length);
  const flat = groups.flatMap((g) => g.items);
  const current = flat.find((i) => (i.end ? pathname === i.to : pathname.startsWith(i.to)));
  const title = meta.path === pathname && meta.title ? meta.title : current?.label || 'CivicSync';
  const subtitle = meta.path === pathname && meta.subtitle ? meta.subtitle : `${ROLE_LABELS[user.role] || user.role}`;
  const ctx = useMemo(() => ({ summary, setMeta }), [summary]);
  const settingsTo = `/${portal}/settings`;
  const create = cfg.create.filter((i) => isVisible(i, user.role));

  const fab = isAdmin ? (
    <button type="button" aria-label="Quick actions" onClick={() => setSheet('new')} className="fab -mt-9 grid size-14 place-items-center rounded-full text-white shadow-lg ring-4 ring-[var(--card)]"><Plus size={26} /></button>
  ) : (
    <Link to="/citizen/report" aria-label="Report an issue" className="fab -mt-9 grid size-14 place-items-center rounded-full text-white shadow-lg ring-4 ring-[var(--card)]"><Plus size={26} /></Link>
  );

  return (
    <ShellContext.Provider value={ctx}>
      <div className="min-h-dvh">
        {/* ---------- Desktop sidebar ---------- */}
        <aside className="sidebar-surface fixed inset-y-0 left-0 z-40 hidden w-64 flex-col p-4 text-white lg:flex">
          <div className="px-2 py-3"><Logo dark subtitle={cfg.label} /></div>
          <nav className="mt-4 flex-1 space-y-5 overflow-y-auto" aria-label="Main">
            {groups.map((g) => (
              <div key={g.group}>
                <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">{g.group}</p>
                {g.items.map((item) => (
                  <NavLink key={item.to} to={item.to} end={item.end}
                    className={({ isActive }) => `flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${isActive ? 'bg-white/15 text-white' : 'text-white/70 hover:bg-white/10 hover:text-white'}`}>
                    <item.icon size={18} />
                    <span className="flex-1">{item.label}</span>
                    {item.badge && summary?.counts.toVerify > 0 && (
                      <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-[#3a2a00]">{summary.counts.toVerify}</span>
                    )}
                  </NavLink>
                ))}
              </div>
            ))}
          </nav>
          <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
            <Avatar name={user.fullName} size={40} />
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{user.fullName}</p>
              <p className="truncate text-xs text-white/60">{ROLE_LABELS[user.role] || user.role}{user.totpEnabled ? ' · 2FA on' : ''}</p>
            </div>
          </div>
        </aside>

        <div className="lg:pl-64">
          <AlertBanner />

          {/* ---------- Desktop top bar ---------- */}
          <header className="glass sticky top-0 z-30 hidden h-16 items-center gap-3 border-b border-slate-200 px-6 lg:flex">
            <SearchBox portal={portal} role={user.role} inputRef={searchRef} />
            <div className="ml-auto flex items-center gap-2">
              {create.length > 0 && (
                <Menu button={({ toggle }) => <Button icon={Plus} onClick={toggle}>New</Button>}>
                  <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Create</p>
                  {create.map((i) => <MenuItem key={i.to} icon={i.icon} onClick={() => navigate(i.to)}>{i.label}</MenuItem>)}
                </Menu>
              )}
              {!isAdmin && <Button to="/citizen/report" icon={Plus}>Report an issue</Button>}
              <Notifications summary={summary} />
              <UserMenu user={user} onLogout={logout} settingsTo={settingsTo} />
            </div>
          </header>

          {/* ---------- Phone top bar ---------- */}
          <header className="glass sticky top-0 z-30 border-b border-slate-200 pt-[env(safe-area-inset-top)] lg:hidden">
            <div className="flex min-h-16 items-center gap-3 px-4">
              <img src="/logo-mark.svg" alt="" width="30" height="30" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-lg font-bold leading-tight text-slate-900">{title}</p>
                <p className="truncate text-xs text-slate-500">{subtitle}</p>
              </div>
              <Notifications summary={summary} />
              <UserMenu user={user} onLogout={logout} settingsTo={settingsTo} />
            </div>
          </header>

          <main className="mx-auto max-w-7xl px-4 pb-32 pt-4 lg:px-8 lg:pb-10 lg:pt-8">
            <Suspense fallback={<div className="space-y-3"><Skeleton className="h-10 w-1/2" /><Skeleton className="h-40" /><Skeleton className="h-40" /></div>}>
              <Outlet />
            </Suspense>
          </main>
        </div>

        {/* ---------- Phone bottom bar ---------- */}
        <nav aria-label="Primary" className="fixed inset-x-3 bottom-3 z-40 pb-[env(safe-area-inset-bottom)] lg:hidden">
          <div className="grid grid-cols-5 items-end rounded-3xl border border-slate-200/70 bg-white px-2 pb-1 pt-2 shadow-xl">
            {cfg.tabs.left.map((t) => <Tab key={t.to} {...t} />)}
            <div className="flex justify-center">{fab}</div>
            {cfg.tabs.right.map((t) => <Tab key={t.to} {...t} />)}
            <button type="button" onClick={() => setSheet('more')} className="flex min-h-14 flex-col items-center justify-center gap-0.5 rounded-2xl text-[11px] font-semibold text-slate-400">
              <span className="grid size-[22px] place-items-center text-[22px] leading-none">≡</span>More
            </button>
          </div>
        </nav>

        <Modal open={sheet === 'more'} onClose={() => setSheet(null)} title="More">
          <div className="grid grid-cols-3 gap-2">
            {cfg.more.filter((i) => isVisible(i, user.role)).map((i) => (
              <Link key={i.to} to={i.to} onClick={() => setSheet(null)} className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center text-xs font-semibold text-slate-700">
                <span className={`grid size-14 place-items-center rounded-2xl ${i.tone || 'bg-slate-100 text-slate-600'}`}><i.icon size={24} /></span>
                {i.label}
              </Link>
            ))}
            <button type="button" onClick={() => logout()} className="flex flex-col items-center gap-2 rounded-2xl p-2 text-center text-xs font-semibold text-red-600">
              <span className="grid size-14 place-items-center rounded-2xl bg-red-50 text-red-600"><LogOut size={24} /></span>
              Log out
            </button>
          </div>
        </Modal>

        <Modal open={sheet === 'new'} onClose={() => setSheet(null)} title="Create">
          <div className="space-y-1">
            {create.map((i) => (
              <Link key={i.to} to={i.to} onClick={() => setSheet(null)} className="flex min-h-12 items-center gap-3 rounded-xl px-2 text-sm font-medium hover:bg-slate-100">
                <span className="grid size-10 place-items-center rounded-xl bg-brand-50 text-brand-700"><i.icon size={20} /></span>
                {i.label}
              </Link>
            ))}
          </div>
        </Modal>

      </div>
    </ShellContext.Provider>
  );
}