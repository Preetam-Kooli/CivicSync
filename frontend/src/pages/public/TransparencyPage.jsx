import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import PublicShell from '../../shared/PublicShell.jsx';
import ChartCanvas from '../../shared/ChartCanvas.jsx';
import { MODULE_LABELS } from '../../shared/mapConfig.js';
import { formatHours, monthLabel } from '../../shared/issueUi.js';

const barOptions = { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };

function Big({ label, value }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className="text-3xl font-semibold text-slate-800">{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

export default function TransparencyPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('GET', '/api/public/transparency')
      .then(setData)
      .catch((err) => setError(err.message));
  }, []);

  const monthly = useMemo(
    () =>
      data && {
        labels: data.monthly.map((m) => monthLabel(m.month)),
        datasets: [
          { label: 'Reported', data: data.monthly.map((m) => m.reported), backgroundColor: '#ea580c' },
          { label: 'Resolved', data: data.monthly.map((m) => m.resolved), backgroundColor: '#059669' },
        ],
      },
    [data]
  );

  const t = data?.totals;

  return (
    <PublicShell>
      <div>
        <h1 className="text-3xl font-semibold text-slate-800">How issues are being resolved</h1>
        <p className="mt-2 text-slate-600">
          Live figures from CivicSync, open to everyone. No personal details are shown here.
        </p>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-slate-500">Loading…</p>}

      {t && (
        <>
          <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Big label="Issues reported" value={t.reported} />
            <Big label="Still open" value={t.open} />
            <Big label="Resolved" value={t.resolved} />
            <Big label="Typical time to resolve" value={formatHours(t.medianResolutionHours)} />
          </section>
          <p className="text-sm text-slate-500">
            {t.slaMetPct === null ? '' : `${t.slaMetPct}% of resolved issues were fixed within their deadline. `}
            {t.confirmed} fixes were confirmed by the citizens who reported them. Updated{' '}
            {new Date(data.refreshedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}.
          </p>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">Reported and resolved per month</h2>
            <ChartCanvas type="bar" data={monthly} options={barOptions} label="Bar chart of reported and resolved issues per month" />
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-lg font-semibold text-slate-800">By area</h2>
            <ul className="space-y-3">
              {data.byModule.map((m) => (
                <li key={m.module}>
                  <div className="flex justify-between text-sm">
                    <span className="font-medium text-slate-700">{MODULE_LABELS[m.module]}</span>
                    <span className="text-slate-500">{m.resolved} of {m.total} resolved</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100" role="img" aria-label={`${m.resolved} of ${m.total} resolved`}>
                    <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${m.total ? (100 * m.resolved) / m.total : 0}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-800">Ward leaderboard</h2>
            <p className="mb-3 text-sm text-slate-500">Ranked by the share of issues resolved, then by speed. Wards need at least 3 reports to be ranked.</p>
            <ol className="divide-y divide-slate-100">
              {data.wards.map((w) => (
                <li key={w.ward} className="flex items-center gap-3 py-3">
                  <span className={`grid size-9 shrink-0 place-items-center rounded-full text-sm font-semibold ${w.rank ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>
                    {w.rank ?? '–'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-800">{w.ward}</p>
                    <p className="text-sm text-slate-500">
                      {w.resolved} of {w.total} resolved · average {formatHours(w.avgResolutionHours)}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-slate-700">{w.resolutionRate}%</span>
                </li>
              ))}
            </ol>
          </section>

          <p className="text-sm text-slate-600">
            Researchers and other apps can use this data too: see the <Link to="/open-data" className="font-medium text-emerald-700 underline">open data API</Link>.
          </p>
        </>
      )}
    </PublicShell>
  );
}