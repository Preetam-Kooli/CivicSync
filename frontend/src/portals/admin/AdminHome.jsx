import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Megaphone } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { useShell } from '../../shell/shellContext.js';
import { api } from '../../lib/api.js';
import PageHeader from '../../shell/PageHeader.jsx';
import Button from '../../ui/Button.jsx';
import { Badge, Card, EmptyState, ModuleTile, Skeleton } from '../../ui/Surface.jsx';
import ChartCanvas from '../../shared/ChartCanvas.jsx';
import { MODULES, MODULE_LABELS } from '../../shared/mapConfig.js';
import { ago } from '../../shared/issueUi.js';
import { ROLE_LABELS } from './constants.js';
import MiniMap from './MiniMap.jsx';

const COLOR = Object.fromEntries(MODULES.map((m) => [m.id, m.color]));
const trendOptions = {
  plugins: { legend: { display: false } },
  scales: {
    y: { beginAtZero: true, grace: '20%', ticks: { precision: 0 }, title: { display: true, text: 'Reports per day' } },
    x: { grid: { display: false } },
  },
};

function Kpi({ label, value, note, tone, dot }) {
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between text-sm text-slate-500">{label}<span className={`size-2.5 rounded-full ${dot}`} /></div>
      <p className="mt-1 text-3xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className={`mt-0.5 text-xs font-semibold ${tone}`}>{note}</p>
    </Card>
  );
}

export default function AdminHome() {
  const { session } = useAuth();
  const { summary } = useShell();
  const [map, setMap] = useState(null);
  const [hour] = useState(() => new Date().getHours());
  const user = session.user;

  useEffect(() => {
    api('GET', '/api/shared/map').then(setMap).catch(() => {});
  }, []);

  const trend = useMemo(
    () =>
      summary && {
        labels: summary.series.map((s) => new Date(`${s.day}T00:00:00`).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })),
        datasets: [{
          label: 'Reported', data: summary.series.map((s) => s.reported),
          borderColor: '#14856e', backgroundColor: 'rgba(20, 133, 110, 0.15)', fill: true,
          tension: 0.35, borderWidth: 3, pointRadius: 4, pointBackgroundColor: '#14856e',
        }],
      },
    [summary]
  );

  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const c = summary?.counts;
  const diff = c ? c.newToday - c.newYesterday : 0;
  const resolvedPct = c && c.resolvedPrev7d ? Math.round((100 * (c.resolved7d - c.resolvedPrev7d)) / c.resolvedPrev7d) : null;
  const maxMod = Math.max(1, ...(summary?.byModule.map((m) => m.total) ?? [1]));

  return (
    <>
      <PageHeader
        title={`${greet}, ${user.fullName.split(' ')[0]}`}
        subtitle={`${ROLE_LABELS[user.role]} · here is what needs you today`}
        actions={user.role !== 'staff' && <Button to="/admin/alerts" variant="outline" icon={Megaphone}>New announcement</Button>}
      />
      {!c ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}</div>
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi label="New today" value={c.newToday} dot="bg-sky-500" tone="text-sky-700" note={`${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff)} vs yesterday`} />
            <Kpi label="In progress" value={c.inProgress} dot="bg-amber-500" tone="text-amber-700" note={`${c.assigned} waiting to start`} />
            <Kpi label="Overdue" value={c.overdue} dot="bg-red-500" tone={c.overdue ? 'text-red-600' : 'text-emerald-700'} note={c.overdue ? 'Needs action now' : 'All on time'} />
            <Kpi label="Resolved · 7 days" value={c.resolved7d} dot="bg-emerald-500" tone="text-emerald-700" note={resolvedPct === null ? 'No earlier data' : `${resolvedPct >= 0 ? '▲' : '▼'} ${Math.abs(resolvedPct)}% vs last week`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <h2 className="mb-3 font-semibold text-slate-900">Reports · last 7 days</h2>
              <ChartCanvas type="line" data={trend} options={trendOptions} height={260} label="Line chart of reports received in the last 7 days" />
            </Card>
            <Card>
              <h2 className="font-semibold text-slate-900">Open issues by category</h2>
              <ul className="mt-3 space-y-3">
                {summary.byModule.length === 0 && <li className="text-sm text-slate-500">No open issues.</li>}
                {summary.byModule.map((m) => (
                  <li key={m.module}>
                    <div className="flex justify-between text-sm"><span className="text-slate-600">{MODULE_LABELS[m.module]}</span><b className="text-slate-900">{m.total}</b></div>
                    <div className="mt-1 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full" style={{ width: `${(100 * m.total) / maxMod}%`, background: COLOR[m.module] }} /></div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <div className="flex items-center justify-between"><h2 className="font-semibold text-slate-900">Needs attention</h2><Link to="/admin/issues" className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700">View all issues <ArrowRight size={14} /></Link></div>
              {summary.attention.length === 0 ? (
                <EmptyState title="You're all caught up">Nothing is overdue or waiting for verification.</EmptyState>
              ) : (
                <ul className="mt-3 space-y-2">
                  {summary.attention.map((i) => (
                    <li key={i.id}>
                      <Link to={`/admin/issues/${i.id}`} className={`flex items-center gap-3 rounded-xl border border-slate-200 border-l-4 p-3 hover:bg-slate-50 ${i.overdue ? 'border-l-red-500' : 'border-l-sky-500'}`}>
                        <ModuleTile module={i.module} size={36} />
                        <span className="min-w-0 flex-1"><span className="block truncate font-medium text-slate-900">{i.title}</span><span className="text-xs text-slate-500">{i.ward || 'No ward'} · {ago(i.createdAt)} ago</span></span>
                        <Badge tone={i.overdue ? 'red' : 'blue'}>{i.overdue ? 'Overdue' : 'New'}</Badge>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <Card>
              <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold text-slate-900">Live issue map</h2><Link to="/admin/map" className="text-sm font-semibold text-brand-700">Open</Link></div>
              {map ? <MiniMap collection={map} /> : <Skeleton className="h-64" />}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}