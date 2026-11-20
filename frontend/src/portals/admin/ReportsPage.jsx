import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Clock, Download, FileText, Printer, TriangleAlert } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import PageHeader from '../../shell/PageHeader.jsx';
import Button from '../../ui/Button.jsx';
import { Card, Segmented, Skeleton } from '../../ui/Surface.jsx';
import ChartCanvas from '../../shared/ChartCanvas.jsx';
import { MODULES, MODULE_LABELS } from '../../shared/mapConfig.js';
import { formatHours } from '../../shared/issueUi.js';

const COLOR = Object.fromEntries(MODULES.map((m) => [m.id, m.color]));
const lineOptions = { plugins: { legend: { position: 'bottom' } }, interaction: { mode: 'index', intersect: false }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } }, x: { ticks: { maxTicksLimit: 8 } } } };

function Kpi({ icon: Icon, tone, label, value, note, good }) {
  return (
    <Card className="flex items-center gap-4 p-4">
      <span className={`grid size-12 shrink-0 place-items-center rounded-xl ${tone}`}><Icon size={22} /></span>
      <div><p className="text-xs text-slate-500">{label}</p><p className="text-2xl font-bold text-slate-900">{value}</p><p className={`text-xs font-semibold ${good ? 'text-emerald-700' : 'text-red-600'}`}>{note}</p></div>
    </Card>
  );
}

export default function ReportsPage() {
  const { session } = useAuth();
  const [days, setDays] = useState('30');
  const [data, setData] = useState(null);

  useEffect(() => {
    let off = false;
    api('GET', `/api/admin/reports?days=${days}`).then((d) => { if (!off) setData(d); }).catch(() => {});
    return () => { off = true; };
  }, [days]);

  const chart = useMemo(() => data && {
    labels: data.daily.map((d) => d.day.slice(5)),
    datasets: [
      { label: 'Reported', data: data.daily.map((d) => d.reported), borderColor: '#14856e', backgroundColor: '#14856e', tension: 0.35, pointRadius: 0 },
      { label: 'Resolved', data: data.daily.map((d) => d.resolved), borderColor: '#f59e0b', backgroundColor: '#f59e0b', tension: 0.35, pointRadius: 0 },
    ],
  }, [data]);

  function exportCsv() {
    const rows = [['date', 'reported', 'resolved'], ...data.daily.map((d) => [d.day, d.reported, d.resolved])];
    const url = URL.createObjectURL(new Blob([rows.map((r) => r.join(',')).join('\n')], { type: 'text/csv' }));
    Object.assign(document.createElement('a'), { href: url, download: `civicsync-report-${days}d.csv` }).click();
    URL.revokeObjectURL(url);
  }

  const k = data?.kpis;
  const avgDelta = k && k.avgHours !== null && k.prevAvgHours ? Math.round((100 * (k.avgHours - k.prevAvgHours)) / k.prevAvgHours) : null;
  const s = data?.status;
  const total = s ? Math.max(1, s.resolved + s.active + s.fresh) : 1;
  const a = s ? Math.round((100 * s.resolved) / total) : 0;
  const b = s ? Math.round((100 * s.active) / total) : 0;
  const maxAvg = Math.max(1, ...(data?.byModule.map((m) => m.avgHours ?? 0) ?? [1]));
  const maxWard = Math.max(1, ...(data?.wards.map((w) => w.total) ?? [1]));

  return (
    <>
      <PageHeader title="Reports & analytics" subtitle={`Performance of the last ${days} days${session.user.role === 'staff' ? ' · your department' : ''}`}
        actions={<>
          <Segmented label="Range" value={days} onChange={setDays} options={[{ value: '7', label: '7 days' }, { value: '30', label: '30 days' }, { value: '90', label: '90 days' }]} />
          <Button variant="secondary" icon={Printer} className="no-print" onClick={() => window.print()}>Export PDF</Button>
          <Button variant="outline" icon={Download} className="no-print" onClick={exportCsv} disabled={!data}>Export CSV</Button>
        </>} />
      {!data ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div> : (
        <div className="space-y-5">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi icon={Clock} tone="bg-brand-50 text-brand-700" label="Avg. resolution time" value={formatHours(k.avgHours)} note={avgDelta === null ? 'No earlier data' : `${avgDelta <= 0 ? '▼' : '▲'} ${Math.abs(avgDelta)}% ${avgDelta <= 0 ? 'faster' : 'slower'}`} good={avgDelta === null || avgDelta <= 0} />
            <Kpi icon={CheckCircle2} tone="bg-emerald-50 text-emerald-700" label="Resolution rate" value={k.resolutionRate === null ? '—' : `${k.resolutionRate}%`} note={k.prevResolutionRate === null || k.resolutionRate === null ? 'No earlier data' : `${k.resolutionRate - k.prevResolutionRate >= 0 ? '▲' : '▼'} ${Math.abs(k.resolutionRate - k.prevResolutionRate)} pts`} good={k.resolutionRate === null || k.prevResolutionRate === null || k.resolutionRate >= k.prevResolutionRate} />
            <Kpi icon={TriangleAlert} tone="bg-red-50 text-red-700" label="Overdue now" value={k.overdueNow} note={k.overdueNow ? 'Needs action' : 'All on time'} good={!k.overdueNow} />
            <Kpi icon={FileText} tone="bg-sky-50 text-sky-700" label="Reported" value={k.reported} note={`${k.reported - k.prevReported >= 0 ? '▲' : '▼'} ${Math.abs(k.reported - k.prevReported)} vs previous`} good />
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2"><h2 className="mb-3 font-semibold text-slate-900">Reported vs resolved</h2><ChartCanvas type="line" data={chart} options={lineOptions} label="Line chart of reported and resolved issues per day" /></Card>
            <Card>
              <h2 className="mb-3 font-semibold text-slate-900">Avg. time by department</h2>
              <ul className="space-y-3">
                {data.byModule.map((m) => (
                  <li key={m.module}><div className="flex justify-between text-sm"><span className="text-slate-600">{MODULE_LABELS[m.module]}</span><b className="text-slate-900">{formatHours(m.avgHours)}</b></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${((m.avgHours ?? 0) / maxAvg) * 100}%`, background: COLOR[m.module] }} /></div></li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h2 className="mb-3 font-semibold text-slate-900">Hotspot wards</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                {data.wards.map((w) => (
                  <div key={w.ward} className="rounded-xl p-3 text-center text-sm font-semibold text-slate-900" style={{ background: `rgb(35 169 142 / ${0.12 + 0.55 * (w.total / maxWard)})` }}>{w.ward}<span className="block text-xs font-normal text-slate-600">{w.total} issues</span></div>
                ))}
                {data.wards.length === 0 && <p className="col-span-full text-sm text-slate-500">No reports in this period.</p>}
              </div>
            </Card>
            <Card className="flex flex-col items-center justify-center gap-4 sm:flex-row lg:flex-col">
              <div role="img" aria-label={`${a}% resolved`} className="grid size-40 place-items-center rounded-full" style={{ background: `conic-gradient(#059669 0 ${a}%, #d97706 ${a}% ${a + b}%, #2563eb ${a + b}% 100%)` }}>
                <div className="grid size-28 place-items-center rounded-full bg-white text-center"><div><p className="text-3xl font-bold text-slate-900">{a}%</p><p className="text-xs text-slate-500">resolved</p></div></div>
              </div>
              <ul className="space-y-1 text-sm text-slate-600"><li>● <span className="text-emerald-600">Resolved</span> {a}%</li><li>● <span className="text-amber-600">In progress</span> {b}%</li><li>● <span className="text-sky-600">New</span> {100 - a - b}%</li></ul>
            </Card>
          </div>
        </div>
      )}
    </>
  );
}