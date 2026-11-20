import { useEffect, useState } from 'react';
import { MoreHorizontal, Search, ShieldCheck, UserPlus } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import { useToast } from '../../ui/toastContext.js';
import PageHeader from '../../shell/PageHeader.jsx';
import Button from '../../ui/Button.jsx';
import { Avatar, Badge, Card, EmptyState, Segmented, Skeleton } from '../../ui/Surface.jsx';
import { ConfirmDialog, Menu, MenuItem } from '../../ui/Overlay.jsx';
import { ago } from '../../shared/issueUi.js';
import { ROLE_LABELS, deptLabel } from './constants.js';

const ADMIN_SIDE = ['staff', 'admin', 'super_admin'];
const TABS = {
  all: () => true,
  citizens: (u) => ['citizen', 'volunteer'].includes(u.role),
  staff: (u) => u.role === 'staff',
  admins: (u) => ['admin', 'super_admin'].includes(u.role),
};

export default function UsersPage() {
  const { session } = useAuth();
  const toast = useToast();
  const isSuper = session.user.role === 'super_admin';
  const [users, setUsers] = useState(null);
  const [tab, setTab] = useState('all');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [key, setKey] = useState(0);

  useEffect(() => {
    if (!isSuper) return;
    let off = false;
    api('GET', '/api/admin/users').then((d) => { if (!off) setUsers(d.users); }).catch((e) => toast(e.message, 'error'));
    return () => { off = true; };
  }, [isSuper, key, toast]);

  if (!isSuper) return <Card><EmptyState title="Super Admins only">Only Super Admins can manage users.</EmptyState></Card>;

  const shown = (users ?? []).filter((u) => TABS[tab](u) && `${u.fullName} ${u.email}`.toLowerCase().includes(q.trim().toLowerCase()));
  const count = (t) => (users ?? []).filter(TABS[t]).length;

  async function run() {
    setBusy(true);
    try {
      await api('POST', `/api/admin/users/${confirm.user.id}/${confirm.path}`);
      toast(confirm.done);
      setConfirm(null);
      setKey((k) => k + 1);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  const ask = (user, kind) => {
    const n = user.fullName;
    setConfirm({
      user,
      ...{
        deactivate: { path: 'deactivate', title: `Deactivate ${n}?`, msg: `${n} will be signed out immediately and can no longer use CivicSync. You can reactivate the account at any time.`, label: 'Deactivate', danger: true, done: 'User deactivated' },
        activate: { path: 'activate', title: `Reactivate ${n}?`, msg: `${n} will be able to sign in again.`, label: 'Reactivate', danger: false, done: 'User reactivated' },
        reset: { path: 'reset-2fa', title: `Reset two-factor for ${n}?`, msg: `${n} will be signed out and must set up their authenticator app again at the next login.`, label: 'Reset 2FA', danger: true, done: 'Two-factor reset' },
      }[kind],
    });
  };

  return (
    <>
      <PageHeader title="Users" subtitle={users ? `${users.length} accounts across citizens, staff and admins` : ''} actions={<Button to="/admin/invites" icon={UserPlus}>Invite user</Button>} />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <Segmented label="Role" value={tab} onChange={setTab} options={[{ value: 'all', label: `All ${users ? count('all') : ''}` }, { value: 'citizens', label: `Citizens ${users ? count('citizens') : ''}` }, { value: 'staff', label: `Staff ${users ? count('staff') : ''}` }, { value: 'admins', label: `Admins ${users ? count('admins') : ''}` }]} />
        <div className="relative min-w-52 flex-1">
          <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search users" placeholder="Search name or email…" className="min-h-11 w-full rounded-xl border border-slate-200 bg-white pl-10 pr-3 text-base outline-none focus:border-brand-600" />
        </div>
      </div>

      {!users && <div className="space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-20" />)}</div>}
      {users && shown.length === 0 && <Card><EmptyState title="No users found">Try another search or tab.</EmptyState></Card>}
      <ul className="space-y-3">
        {shown.map((u) => {
          const self = String(u.id) === String(session.user.id);
          return (
            <li key={u.id}>
              <Card className="grid items-center gap-3 p-4 lg:grid-cols-[2fr_1.2fr_1fr_1fr_1fr_auto]">
                <div className="flex min-w-0 items-center gap-3"><Avatar name={u.fullName} size={44} /><div className="min-w-0"><p className="truncate font-semibold text-slate-900">{u.fullName}{self && <span className="text-xs font-normal text-slate-400"> (you)</span>}</p><p className="truncate text-sm text-slate-500">{u.email}</p></div></div>
                <div><Badge tone="green">{ROLE_LABELS[u.role]}{u.department ? ` · ${deptLabel(u.department)}` : ''}</Badge></div>
                <div className="flex gap-1.5"><Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge>{u.isLocked && <Badge tone="amber">Locked</Badge>}</div>
                <div>{ADMIN_SIDE.includes(u.role) ? <Badge tone={u.totpEnabled ? 'blue' : 'amber'}><ShieldCheck size={12} />{u.totpEnabled ? '2FA on' : '2FA not set up'}</Badge> : <span className="text-slate-400">—</span>}</div>
                <div className="text-sm text-slate-500">{u.lastActive ? `${ago(u.lastActive)} ago` : 'Never'}</div>
                <Menu button={({ toggle }) => <button type="button" aria-label={`Actions for ${u.fullName}`} onClick={toggle} className="grid size-11 place-items-center rounded-xl text-slate-500 hover:bg-slate-100"><MoreHorizontal size={20} /></button>}>
                  {ADMIN_SIDE.includes(u.role) && <MenuItem icon={ShieldCheck} onClick={() => ask(u, 'reset')}>Reset 2FA</MenuItem>}
                  {u.isActive ? <MenuItem danger disabled={self} onClick={() => ask(u, 'deactivate')}>Deactivate…</MenuItem> : <MenuItem onClick={() => ask(u, 'activate')}>Reactivate…</MenuItem>}
                </Menu>
              </Card>
            </li>
          );
        })}
      </ul>

      <ConfirmDialog open={Boolean(confirm)} danger={confirm?.danger} busy={busy} title={confirm?.title} message={confirm?.msg} confirmLabel={confirm?.label} onCancel={() => setConfirm(null)} onConfirm={run} />
    </>
  );
}