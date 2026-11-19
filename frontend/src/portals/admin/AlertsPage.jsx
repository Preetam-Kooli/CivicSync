import { useEffect, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import Field from '../../shared/Field.jsx';
import { formatDateTime } from '../../shared/issueUi.js';

const selectClass = 'mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base';
const ZONE_STYLE = { normal: 'bg-sky-50 text-sky-700', watch: 'bg-amber-50 text-amber-800', high: 'bg-red-50 text-red-700' };
const SEVERITY_STYLE = { critical: 'bg-red-50 text-red-700', warning: 'bg-amber-50 text-amber-800', info: 'bg-sky-50 text-sky-700' };

function stateOf(a) {
  if (a.withdrawnAt) return 'withdrawn';
  return new Date(a.expiresAt) <= new Date() ? 'expired' : 'live';
}

export default function AlertsPage() {
  const { session } = useAuth();
  const allowed = session.user.role !== 'staff';

  const [alerts, setAlerts] = useState(null);
  const [zones, setZones] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [form, setForm] = useState({ kind: 'general', severity: 'warning', title: '', message: '', hours: '6' });
  const [fieldErrors, setFieldErrors] = useState({});
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!allowed) return;
    let cancelled = false;
    Promise.all([api('GET', '/api/admin/alerts'), api('GET', '/api/admin/flood-zones')])
      .then(([a, z]) => {
        if (cancelled) return;
        setAlerts(a.alerts);
        setZones(z.zones);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [allowed, reloadKey]);

  if (!allowed) {
    return <p className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">Only Admins and Super Admins can post alerts.</p>;
  }

  const set = (name) => (e) => setForm((f) => ({ ...f, [name]: e.target.value }));

  async function post(e) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    setFieldErrors({});
    try {
      await api('POST', '/api/admin/alerts', { ...form, hours: Number(form.hours) });
      setForm((f) => ({ ...f, title: '', message: '' }));
      setNote('Alert posted. It appears at the top of every page within a minute.');
      setReloadKey((k) => k + 1);
    } catch (err) {
      const fromServer = {};
      for (const item of err.errors || []) if (!fromServer[item.field]) fromServer[item.field] = item.message;
      setFieldErrors(fromServer);
      if (Object.keys(fromServer).length === 0) setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function withdraw(a) {
    if (!window.confirm(`Withdraw "${a.title}"?`)) return;
    try {
      await api('POST', `/api/admin/alerts/${a.id}/withdraw`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    }
  }

  async function checkNow() {
    setBusy(true);
    setError('');
    setNote('');
    try {
      const d = await api('POST', '/api/admin/weather/check');
      setNote(`Checked ${d.summary.checked} of ${d.summary.zones} zones. ${d.summary.alerting} need attention.`);
      setReloadKey((k) => k + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-slate-800">Alerts</h1>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {note && <p role="status" className="rounded-lg bg-emerald-50 p-3 text-sm text-emerald-800">{note}</p>}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-800">Post an emergency alert</h2>
        <form onSubmit={post} className="mt-4 space-y-4" noValidate>
          <div className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="kind" className="block text-sm font-medium text-slate-700">Type</label>
              <select id="kind" value={form.kind} onChange={set('kind')} className={selectClass}>
                <option value="general">General notice</option>
                <option value="flood">Flood</option>
                <option value="road_closure">Road closure</option>
                <option value="fire">Fire</option>
                <option value="weather">Weather</option>
              </select>
            </div>
            <div>
              <label htmlFor="severity" className="block text-sm font-medium text-slate-700">How urgent?</label>
              <select id="severity" value={form.severity} onChange={set('severity')} className={selectClass}>
                <option value="info">Information</option>
                <option value="warning">Warning</option>
                <option value="critical">Critical (cannot be dismissed)</option>
              </select>
            </div>
            <div>
              <label htmlFor="hours" className="block text-sm font-medium text-slate-700">Show for</label>
              <select id="hours" value={form.hours} onChange={set('hours')} className={selectClass}>
                {[1, 3, 6, 12, 24, 48, 72].map((h) => (
                  <option key={h} value={h}>{h} hour{h === 1 ? '' : 's'}</option>
                ))}
              </select>
              {fieldErrors.hours && <p className="mt-1 text-sm text-red-600">{fieldErrors.hours}</p>}
            </div>
          </div>
          <Field id="title" label="Headline" maxLength={120} value={form.title} onChange={set('title')} error={fieldErrors.title} />
          <div>
            <label htmlFor="message" className="block text-sm font-medium text-slate-700">What should people do?</label>
            <textarea id="message" rows={3} maxLength={500} value={form.message} onChange={set('message')}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-base focus:border-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-200" />
            {fieldErrors.message && <p className="mt-1 text-sm text-red-600">{fieldErrors.message}</p>}
          </div>
          <button type="submit" disabled={busy} className="min-h-11 rounded-lg bg-emerald-600 px-6 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
            {busy ? 'Posting…' : 'Post alert'}
          </button>
        </form>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-800">Flood zones</h2>
          <button type="button" onClick={checkNow} disabled={busy} className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 hover:bg-slate-50 disabled:opacity-60">
            Check weather now
          </button>
        </div>
        <p className="text-sm text-slate-500">The server checks the 24-hour rain forecast for each zone every 30 minutes and posts an automatic alert at watch or high.</p>
        {!zones && !error && <p className="text-slate-500">Loading…</p>}
        {zones?.length === 0 && <p className="text-slate-500">No flood zones yet.</p>}
        <ul className="space-y-3">
          {zones?.map((z) => (
            <li key={z.id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-white p-4 shadow-sm">
              <div>
                <p className="font-medium text-slate-800">{z.name}</p>
                <p className="text-sm text-slate-500">
                  Watch at {z.watchMm} mm · high at {z.highMm} mm · forecast {z.forecastMm === null ? 'not checked yet' : `${z.forecastMm} mm`}
                  {z.checkedAt ? ` · checked ${formatDateTime(z.checkedAt)}` : ''}
                </p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${ZONE_STYLE[z.status]}`}>{z.status}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-slate-800">Recent alerts</h2>
        {alerts?.length === 0 && <p className="text-slate-500">Nothing posted yet.</p>}
        <ul className="space-y-3">
          {alerts?.map((a) => {
            const state = stateOf(a);
            return (
              <li key={a.id} className="rounded-2xl bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-800">{a.title}</p>
                    <p className="text-sm text-slate-600">{a.message}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      {a.source === 'weather' ? 'Automatic (weather)' : `Posted by ${a.postedBy || 'an admin'}`} · until {formatDateTime(a.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLE[a.severity]}`}>{a.severity}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">{state}</span>
                    {state === 'live' && (
                      <button type="button" onClick={() => withdraw(a)} className="min-h-11 rounded-lg border border-slate-300 px-3 text-sm hover:bg-slate-100">
                        Withdraw
                      </button>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}