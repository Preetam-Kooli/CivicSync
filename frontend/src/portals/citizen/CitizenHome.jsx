import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Camera, ListChecks } from 'lucide-react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import PageHeader from '../../shell/PageHeader.jsx';
import { Card, EmptyState, ModuleTile, Skeleton } from '../../ui/Surface.jsx';
import Button from '../../ui/Button.jsx';
import StatusBadge from '../../shared/StatusBadge.jsx';
import { ago } from '../../shared/issueUi.js';

export default function CitizenHome() {
  const { session } = useAuth();
  const [issues, setIssues] = useState(null);
  const [hour] = useState(() => new Date().getHours());

  useEffect(() => {
    let off = false;
    api('GET', '/api/citizen/issues').then((d) => { if (!off) setIssues(d.issues); }).catch(() => { if (!off) setIssues([]); });
    return () => { off = true; };
  }, []);

  const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return (
    <>
      <PageHeader title={`${greet}, ${session.user.fullName.split(' ')[0]}`} subtitle="Report problems and follow their progress" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Link to="/citizen/report" className="fab flex items-center gap-4 rounded-3xl p-6 text-white shadow-lg">
          <span className="grid size-14 place-items-center rounded-2xl bg-white/20"><Camera size={28} /></span>
          <span><b className="block text-lg">Report an issue</b><span className="text-sm text-white/80">Potholes, streetlights, flooding, fire hazards</span></span>
        </Link>
        <Link to="/citizen/reports" className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <span className="grid size-14 place-items-center rounded-2xl bg-brand-50 text-brand-700"><ListChecks size={28} /></span>
          <span><b className="block text-lg text-slate-900">My reports</b><span className="text-sm text-slate-500">Track what you reported</span></span>
        </Link>
      </div>
      <h2 className="mb-3 mt-7 font-semibold text-slate-900">Recent reports</h2>
      {!issues && <Skeleton className="h-24" />}
      {issues?.length === 0 && <Card><EmptyState title="No reports yet" action={<Button to="/citizen/report">Report your first issue</Button>}>When you report a problem it appears here with live progress.</EmptyState></Card>}
      <ul className="space-y-3">
        {issues?.slice(0, 4).map((i) => (
          <li key={i.id}>
            <Link to={`/citizen/reports/${i.id}`} className="flex items-center gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
              <ModuleTile module={i.category.module} size={44} />
              <span className="min-w-0 flex-1"><b className="block truncate text-slate-900">{i.title}</b><span className="text-xs text-slate-500">{i.category.name} · {ago(i.createdAt)} ago</span></span>
              <StatusBadge status={i.status} />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}