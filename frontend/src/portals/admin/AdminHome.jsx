import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import StatusBadge from '../../shared/StatusBadge.jsx';
import SlaBadge from '../../shared/SlaBadge.jsx';
import { MODULE_LABELS } from '../../shared/mapConfig.js';
import { ROLE_LABELS } from './constants.js';

function Stat({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className={`text-3xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function AdminHome() {
  const { session } = useAuth();
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState('');
  // Captured once when the page opens. Calling Date.now() while rendering is what the rule objects to.
  const [now] = useState(() => Date.now());

  useEffect(() => {
    api('GET', '/api/admin/issues')
      .then((d) => setIssues(d.issues))
      .catch((err) => setError(err.message));
  }, []);

  const stats = useMemo(() => {
    if (!issues) return null;
    const open = issues.filter((i) => i.status !== 'resolved');
    return {
      open: open.length,
      overdue: open.filter((i) => i.slaDeadline && new Date(i.slaDeadline).getTime() < now).length,
      escalated: open.filter((i) => i.escalationLevel > 0).length,
      awaiting: issues.filter((i) => i.status === 'resolved' && !i.confirmedAt).length,
      // The API already sorts open issues by priority, highest first
      urgent: open.slice(0, 5),
    };
  }, [issues, now]);

  const isStaff = session.user.role === 'staff';

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-lg">
          Welcome, <strong>{session.user.fullName}</strong>
        </p>
        <p className="mt-1 text-sm text-slate-500">
          {ROLE_LABELS[session.user.role] || session.user.role}
          {isStaff ? ' · you see the issues of your own department' : ''}
        </p>
      </section>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!issues && !error && <p className="text-slate-500">Loading…</p>}

      {stats && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Open issues" value={stats.open} />
            <Stat label="Past their deadline" value={stats.overdue} tone={stats.overdue ? 'text-red-700' : 'text-slate-800'} />
            <Stat label="Escalated" value={stats.escalated} tone={stats.escalated ? 'text-orange-700' : 'text-slate-800'} />
            <Stat label="Fixed, awaiting confirmation" value={stats.awaiting} />
          </section>

          <section className="rounded-2xl bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-800">Most urgent right now</h2>
              <Link to="/admin/issues" className="min-h-11 py-2 text-sm font-medium text-amber-800 underline">
                All issues
              </Link>
            </div>

            {stats.urgent.length === 0 && (
              <p className="mt-3 text-slate-500">No open issues. Everything reported has been resolved.</p>
            )}

            <ul className="mt-3 divide-y divide-slate-100">
              {stats.urgent.map((i) => (
                <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <Link to={`/admin/issues/${i.id}`} className="font-medium text-slate-800 underline decoration-slate-300 underline-offset-2">
                      {i.title}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {i.category.name} · {MODULE_LABELS[i.category.module]}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <StatusBadge status={i.status} />
                    <SlaBadge deadline={i.slaDeadline} status={i.status} escalationLevel={i.escalationLevel} />
                    <span className="rounded-lg bg-slate-800 px-2 py-1 text-sm font-semibold text-white" title="Priority score">
                      {Math.round(i.priorityScore)}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}