import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import { ROLE_LABELS, deptLabel } from './constants.js';

const ADMIN_SIDE = ['staff', 'admin', 'super_admin'];

function Badge({ tone, children }) {
  const tones = {
    green: 'bg-emerald-50 text-emerald-700',
    red: 'bg-red-50 text-red-700',
    amber: 'bg-amber-50 text-amber-800',
    grey: 'bg-slate-100 text-slate-600',
  };
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tones[tone]}`}>{children}</span>;
}

export default function UsersPage() {
  const { session } = useAuth();
  const isSuper = session.user.role === 'super_admin';
  const [users, setUsers] = useState(null);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    try {
      const data = await api('GET', '/api/admin/users');
      setUsers(data.users);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    if (!isSuper) return;

    const timer = setTimeout(() => {
      load();
    }, 0);

    return () => clearTimeout(timer);
  }, [isSuper, load]);

  if (!isSuper) {
    return <p className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">Only Super Admins can manage users.</p>;
  }

  async function act(user, action, question) {
    if (!window.confirm(question)) return;
    setBusyId(user.id);
    setError('');
    try {
      await api('POST', `/api/admin/users/${user.id}/${action}`);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusyId(null);
    }
  }

  const btn = 'min-h-11 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-100 disabled:opacity-50';

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Users</h1>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}
      {!users && !error && <p className="text-slate-500">Loading…</p>}

      <ul className="space-y-3">
        {users?.map((u) => {
          const isSelf = String(u.id) === String(session.user.id);
          return (
            <li key={u.id} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-800">
                    {u.fullName} {isSelf && <span className="text-xs text-slate-500">(you)</span>}
                  </p>
                  <p className="truncate text-sm text-slate-500">{u.email}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone="grey">{ROLE_LABELS[u.role] || u.role}</Badge>
                    {u.department && <Badge tone="grey">{deptLabel(u.department)}</Badge>}
                    <Badge tone={u.isActive ? 'green' : 'red'}>{u.isActive ? 'Active' : 'Deactivated'}</Badge>
                    {u.isLocked && <Badge tone="amber">Locked</Badge>}
                    {ADMIN_SIDE.includes(u.role) && (
                      <Badge tone={u.totpEnabled ? 'green' : 'amber'}>
                        {u.totpEnabled ? '2FA on' : '2FA not set up'}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {ADMIN_SIDE.includes(u.role) && (
                    <button
                      type="button"
                      className={btn}
                      disabled={busyId === u.id}
                      onClick={() =>
                        act(u, 'reset-2fa', `Reset two-factor authentication for ${u.email}? They must set it up again at their next login.`)
                      }
                    >
                      Reset 2FA
                    </button>
                  )}
                  {u.isActive ? (
                    <button
                      type="button"
                      className={btn}
                      disabled={busyId === u.id || isSelf}
                      onClick={() => act(u, 'deactivate', `Deactivate ${u.email}? They will be signed out immediately.`)}
                    >
                      Deactivate
                    </button>
                  ) : (
                    <button
                      type="button"
                      className={btn}
                      disabled={busyId === u.id}
                      onClick={() => act(u, 'activate', `Reactivate ${u.email}?`)}
                    >
                      Reactivate
                    </button>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}