import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { ModuleTile } from '../../ui/Surface.jsx';
import SlaBadge from '../../shared/SlaBadge.jsx';
import { STATUS_LABELS, STATUS_ORDER, ago } from '../../shared/issueUi.js';

const NEXT = { reported: 'verified', verified: 'assigned', assigned: 'in_progress', in_progress: 'resolved' };
const HEAD = { reported: 'text-sky-700', verified: 'text-violet-700', assigned: 'text-amber-700', in_progress: 'text-orange-700', resolved: 'text-emerald-700' };

export default function IssueBoard({ issues, onMove }) {
  const [over, setOver] = useState('');
  return (
    <div className="no-scrollbar -mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:px-0">
      {STATUS_ORDER.map((s) => {
        const col = issues.filter((i) => i.status === s);
        return (
          <section key={s} aria-label={STATUS_LABELS[s]}
            onDragOver={(e) => { e.preventDefault(); setOver(s); }} onDragLeave={() => setOver('')}
            onDrop={(e) => { e.preventDefault(); setOver(''); const id = e.dataTransfer.getData('text/plain'); const issue = issues.find((i) => String(i.id) === id); if (issue && issue.status !== s) onMove(issue, s); }}
            className={`w-64 shrink-0 snap-start rounded-2xl bg-slate-100/70 p-3 lg:w-auto lg:min-w-0 lg:flex-1 ${over === s ? 'ring-2 ring-brand-500' : ''}`}>
            <h3 className={`mb-3 flex items-center justify-between text-sm font-bold ${HEAD[s]}`}>● {STATUS_LABELS[s]}<span className="rounded-full bg-white px-2 text-xs text-slate-500">{col.length}</span></h3>
            <div className="space-y-2.5">
              {col.map((i) => (
                <article key={i.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i.id))} className="cursor-grab rounded-xl border border-slate-200 bg-white p-3 shadow-sm active:cursor-grabbing">
                  <Link to={`/admin/issues/${i.id}`} className="block text-sm font-semibold text-slate-900 hover:underline">{i.title}</Link>
                  <p className="mt-0.5 text-xs text-slate-500">#CS-{i.id} · {i.ward || 'No ward'} · {ago(i.createdAt)}</p>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2"><ModuleTile module={i.category.module} size={24} /><SlaBadge deadline={i.slaDeadline} status={i.status} /></span>
                    {NEXT[i.status] && (
                      <button type="button" onClick={() => onMove(i, NEXT[i.status])} aria-label={`Move to ${STATUS_LABELS[NEXT[i.status]]}`} className="grid size-11 place-items-center rounded-xl text-brand-700 hover:bg-brand-50"><ArrowRight size={18} /></button>
                    )}
                  </div>
                </article>
              ))}
              {col.length === 0 && <p className="py-6 text-center text-xs text-slate-400">Nothing here</p>}
            </div>
          </section>
        );
      })}
    </div>
  );
}