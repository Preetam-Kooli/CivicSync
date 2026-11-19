import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import ChartCanvas from '../../shared/ChartCanvas.jsx';
import { MODULES, MODULE_LABELS } from '../../shared/mapConfig.js';
import { STATUS_LABELS, STATUS_ORDER, formatHours, monthLabel } from '../../shared/issueUi.js';

const STATUS_COLORS = { reported: '#64748b', verified: '#0284c7', assigned: '#7c3aed', in_progress: '#d97706', resolved: '#059669' };
const MODULE_COLOR = Object.fromEntries(MODULES.map((m) => [m.id, m.color]));

const lineOptions = { plugins: { legend: { position: 'bottom' } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
const barOptions = { plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } };
const stackedWardOptions = {
  indexAxis: 'y',
  plugins: { legend: { position: 'bottom' } },
  scales: { x: { stacked: true, beginAtZero: true, ticks: { precision: 0 } }, y: { stacked: true } },
};
const hoursOptions = {
  plugins: { legend: { position: 'bottom' } },
  scales: { y: { beginAtZero: true, title: { display: true, text: 'hours' } } },
};
const doughnutOptions = { plugins: { legend: { position: 'bottom' } } };

function Kpi({ label, value, tone = 'text-slate-800' }) {
  return (
    <div className="rounded-2xl bg-white p-4 shadow-sm">
      <p className={`text-2xl font-semibold ${tone}`}>{value}</p>
      <p className="mt-1 text-sm text-slate-500">{label}</p>
    </div>
  );
}

function Panel({ title, children }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-3 text-lg font-semibold text-slate-800">{title}</h2>
      {children}
    </section>
  );
}

export default function AnalyticsPage() {
  const { session } = useAuth();
  const isStaff = session.user.role === 'staff';
  const [module, setModule] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    api('GET', `/api/admin/analytics${module ? `?module=${module}` : ''}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [module]);

  const charts = useMemo(() => {
    if (!data) return null;
    const mods = data.byModule;
    return {
      trend: {
        labels: data.monthly.map((m) => monthLabel(m.month)),
        datasets: [
          { label: 'Reported', data: data.monthly.map((m) => m.reported), borderColor: '#ea580c', backgroundColor: '#ea580c', tension: 0.3 },
          { label: 'Resolved', data: data.monthly.map((m) => m.resolved), borderColor: '#059669', backgroundColor: '#059669', tension: 0.3 },
        ],
      },
      byModule: {
        labels: mods.map((m) => MODULE_LABELS[m.module]),
        datasets: [{ data: mods.map((m) => m.total), backgroundColor: mods.map((m) => MODULE_COLOR[m.module]) }],
      },
      byStatus: {
        labels: STATUS_ORDER.map((s) => STATUS_LABELS[s]),
        datasets: [{
          data: STATUS_ORDER.map((s) => data.byStatus.find((x) => x.status === s)?.count ?? 0),
          backgroundColor: STATUS_ORDER.map((s) => STATUS_COLORS[s]),
        }],
      },
      byWard: {
        labels: data.byWard.map((w) => w.ward),
        datasets: [
          { label: 'Open', data: data.byWard.map((w) => w.open), backgroundColor: '#f59e0b' },
          { label: 'Resolved', data: data.byWard.map((w) => w.resolved), backgroundColor: '#059669' },
        ],
      },
      times: {
        labels: mods.map((m) => MODULE_LABELS[m.module]),
        datasets: [
          { label: 'First response', data: mods.map((m) => m.avgFirstResponseHours), backgroundColor: '#0284c7' },
          { label: 'Fully resolved', data: mods.map((m) => m.avgResolutionHours), backgroundColor: '#7c3aed' },
        ],
      },
    };
  }, [data]);

  const k = data?.kpis;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-slate-800">Analytics</h1>
        {!isStaff && (
          <select aria-label="Filter by area" value={module} onChange={(e) => setModule(e.target.value)} className="min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base">
            <option value="">All areas</option>
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}
      </div>
      {isStaff && <p className="text-sm text-slate-500">Showing your department only.</p>}

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!data && !error && <p className="text-slate-500">Loading…</p>}

      {k && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
            <Kpi label="Open issues" value={k.open} />
            <Kpi label="Resolved" value={k.resolved} />
            <Kpi label="Escalated (open)" value={k.escalated} tone={k.escalated ? 'text-orange-700' : 'text-slate-800'} />
            <Kpi label="Average first response" value={formatHours(k.avgFirstResponseHours)} />
            <Kpi label="Average time to resolve" value={formatHours(k.avgResolutionHours)} />
            <Kpi label="Resolved within deadline" value={k.slaMetPct === null ? '—' : `${k.slaMetPct}%`} />
          </div>

          <Panel title="Reported and resolved per month">
            <ChartCanvas type="line" data={charts.trend} options={lineOptions} label="Line chart of reported and resolved issues per month" />
          </Panel>

          <div className="grid gap-5 lg:grid-cols-2">
            <Panel title="Issues by area">
              <ChartCanvas type="bar" data={charts.byModule} options={barOptions} label="Bar chart of issues by area" />
            </Panel>
            <Panel title="Issues by status">
              <ChartCanvas type="doughnut" data={charts.byStatus} options={doughnutOptions} label="Doughnut chart of issues by status" />
            </Panel>
          </div>

          <Panel title="Issues by ward">
            <ChartCanvas type="bar" data={charts.byWard} options={stackedWardOptions} label="Stacked bar chart of open and resolved issues by ward" height={Math.max(220, data.byWard.length * 36)} />
          </Panel>

          <Panel title="Response and resolution time by area">
            <ChartCanvas type="bar" data={charts.times} options={hoursOptions} label="Bar chart of average response and resolution hours by area" />
          </Panel>
        </>
      )}
    </div>
  );
}