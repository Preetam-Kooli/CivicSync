import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChevronLeft, ChevronRight, ListChecks, Search } from 'lucide-react';
import { api } from '../../lib/api.js';
import { useToast } from '../../ui/toastContext.js';
import PageHeader from '../../shell/PageHeader.jsx';
import Button from '../../ui/Button.jsx';
import { Avatar, Card, EmptyState, ModuleTile, Segmented, Skeleton } from '../../ui/Surface.jsx';
import { Modal } from '../../ui/Overlay.jsx';
import StatusBadge from '../../shared/StatusBadge.jsx';
import { MODULE_LABELS } from '../../shared/mapConfig.js';
import { STATUS_LABELS, STATUS_ORDER, ago, slaInfo } from '../../shared/issueUi.js';
import IssueBoard from './IssueBoard.jsx';

const PAGE = 25;
const NEXT = { reported: 'verified', verified: 'assigned', assigned: 'in_progress', in_progress: 'resolved' };

function AssignModal({ issue, onClose, onDone }) {
  const toast = useToast();
  const [people, setPeople] = useState(null);
  const [pick, setPick] = useState('');
  useEffect(() => {
    api('GET', `/api/admin/issues/${issue.id}`).then((d) => setPeople(d.assignees)).catch((e) => toast(e.message, 'error'));
  }, [issue.id, toast]);
  async function save() {
    try {
      await api('POST', `/api/admin/issues/${issue.id}/transition`, { to: 'assigned', assigneeId: Number(pick) });
      toast('Issue assigned');
      onDone();
    } catch (e) {
      toast(e.message, 'error');
    }
  }
  return (
    <>
      <p className="mb-3 text-sm text-slate-500">{issue.title}</p>
      <select aria-label="Assign to" value={pick} onChange={(e) => setPick(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base">
        <option value="">{people ? 'Choose a person…' : 'Loading…'}</option>
        {people?.map((p) => <option key={p.id} value={p.id}>{p.fullName}</option>)}
      </select>
      <div className="mt-4 grid grid-cols-2 gap-3"><Button variant="secondary" onClick={onClose}>Cancel</Button><Button disabled={!pick} onClick={save}>Assign</Button></div>
    </>
  );
}

export default function IssuesPage() {
  const toast = useToast();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const view = params.get('view') === 'board' ? 'board' : 'list';
  const status = params.get('status') || '';
  const [q, setQ] = useState('');
  const [dq, setDq] = useState('');
  const [page, setPage] = useState(0);
  const [data, setData] = useState(null);
  const [failed, setFailed] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [assigning, setAssigning] = useState(null);
  const [key, setKey] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDq(q), 300);
    return () => clearTimeout(id);
  }, [q]);

  useEffect(() => {
    let off = false;
    const sp = new URLSearchParams({ limit: view === 'board' ? '200' : String(PAGE), offset: view === 'board' ? '0' : String(page * PAGE) });
    if (dq) sp.set('q', dq);
    if (status && view === 'list') sp.set('status', status);
    api('GET', `/api/admin/issue-list?${sp}`)
      .then((d) => { if (!off) { setData(d); setFailed(''); } })
      .catch((e) => { if (!off) setFailed(e.message); });
    return () => { off = true; };
  }, [dq, status, page, view, key]);

  const setParam = (name, value) => {
    const next = new URLSearchParams(params);
    if (value) next.set(name, value); else next.delete(name);
    setParams(next, { replace: true });
    setPage(0);
    setSelected(new Set());
  };

  async function advance(issue, to) {
    if (NEXT[issue.status] !== to) return toast('Move cards one step forward at a time', 'error');
    if (to === 'assigned') return setAssigning(issue);
    if (to === 'resolved') { toast('Add the "after" photo on the issue page to resolve it', 'info'); return navigate(`/admin/issues/${issue.id}`); }
    try {
      await api('POST', `/api/admin/issues/${issue.id}/transition`, { to });
      toast(`Moved to ${STATUS_LABELS[to]}`);
      setKey((k) => k + 1);
    } catch (e) {
      toast(e.message, 'error');
    }
  }

  async function bulk(from, to, label) {
    const ids = (data?.issues ?? []).filter((i) => selected.has(i.id) && i.status === from).map((i) => i.id);
    if (!ids.length) return toast(`Select issues that are "${STATUS_LABELS[from]}" first`, 'error');
    const res = await Promise.allSettled(ids.map((id) => api('POST', `/api/admin/issues/${id}/transition`, { to })));
    const ok = res.filter((r) => r.status === 'fulfilled').length;
    toast(`${label}: ${ok} of ${ids.length} done`, ok === ids.length ? 'success' : 'error');
    setSelected(new Set());
    setKey((k) => k + 1);
  }

  const toggle = (id) => setSelected((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const issues = data?.issues ?? [];
  const counts = data?.counts;
  const chips = [{ v: '', label: 'All', n: counts?.all }, ...STATUS_ORDER.map((s) => ({ v: s, label: STATUS_LABELS[s], n: counts?.[s] ?? 0 }))];
  const pages = data ? Math.max(1, Math.ceil(data.total / PAGE)) : 1;

  return (
    <>
      <PageHeader title="Issues" subtitle={data ? `${counts.all} reports · sorted by urgency` : ''}
        actions={<Segmented label="View" value={view} onChange={(v) => v === 'map' ? navigate('/admin/map') : setParam('view', v === 'board' ? 'board' : '')} options={[{ value: 'list', label: 'List' }, { value: 'board', label: 'Board' }, { value: 'map', label: 'Map' }]} />} />

      <div className="relative mb-3">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input value={q} onChange={(e) => { setQ(e.target.value); setPage(0); }} aria-label="Search issues" placeholder="Search by title, ID or street…"
          className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white pl-10 pr-3 text-base outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-200" />
      </div>

      {view === 'list' && (
        <div className="no-scrollbar mb-4 flex gap-2 overflow-x-auto pb-1">
          {chips.map((c) => (
            <button key={c.v} type="button" aria-pressed={status === c.v} onClick={() => setParam('status', c.v)}
              className={`flex min-h-11 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-semibold ${status === c.v ? 'border-brand-600 bg-brand-600 text-white' : 'border-slate-200 bg-white text-slate-600'}`}>
              {c.label}<span className={`rounded-full px-2 text-xs ${status === c.v ? 'bg-white/25' : 'bg-slate-100'}`}>{c.n ?? '…'}</span>
            </button>
          ))}
        </div>
      )}

      {failed && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{failed}</p>}
      {!data && !failed && <div className="space-y-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>}

      {data && view === 'board' && <IssueBoard issues={issues} onMove={advance} />}

      {data && view === 'list' && (
        <>
          {selected.size > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-3 rounded-2xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
              {selected.size} selected
              <button type="button" className="min-h-11 rounded-lg px-2 hover:bg-white/15" onClick={() => bulk('reported', 'verified', 'Verified')}>Verify</button>
              <button type="button" className="min-h-11 rounded-lg px-2 hover:bg-white/15" onClick={() => bulk('assigned', 'in_progress', 'Started')}>Start work</button>
              <button type="button" className="ml-auto min-h-11 rounded-lg px-2 hover:bg-white/15" onClick={() => setSelected(new Set())}>Clear</button>
            </div>
          )}
          {issues.length === 0 ? (
            <Card><EmptyState icon={ListChecks} title="You're all caught up" action={<Button variant="outline" onClick={() => { setQ(''); setParam('status', ''); }}>Clear filters</Button>}>No issues match these filters.</EmptyState></Card>
          ) : (
            <>
              {/* Phone: cards */}
              <ul className="space-y-3 lg:hidden">
                {issues.map((i) => {
                  const sla = slaInfo(i.slaDeadline, i.status);
                  return (
                    <li key={i.id}>
                      <Link to={`/admin/issues/${i.id}`} className="flex gap-3 rounded-2xl border border-slate-200/70 bg-white p-3 shadow-sm">
                        <ModuleTile module={i.category.module} size={52} />
                        <span className="min-w-0 flex-1">
                          <span className="flex justify-between gap-2"><b className="truncate text-slate-900">{i.title}</b><span className="shrink-0 text-xs text-slate-400">{ago(i.createdAt)}</span></span>
                          <span className="block truncate text-xs text-slate-500">{i.ward || 'No ward'} · {i.category.name}</span>
                          <span className="mt-1.5 flex items-center gap-2"><StatusBadge status={i.status} /><span className={`text-xs font-semibold ${sla.tone}`}>{sla.text}</span></span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
              {/* Desktop: table */}
              <Card className="hidden overflow-hidden p-0 lg:block">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-slate-200 text-xs uppercase tracking-wider text-slate-400">
                    <tr><th className="w-12 p-3"><input type="checkbox" aria-label="Select all" checked={issues.every((i) => selected.has(i.id))} onChange={(e) => setSelected(e.target.checked ? new Set(issues.map((i) => i.id)) : new Set())} className="size-4 accent-[#14856e]" /></th>
                      <th className="p-3">ID</th><th className="p-3">Issue</th><th className="p-3">Location</th><th className="p-3">Status</th><th className="p-3">Assignee</th><th className="p-3">Deadline</th><th className="p-3">Age</th></tr>
                  </thead>
                  <tbody>
                    {issues.map((i) => {
                      const sla = slaInfo(i.slaDeadline, i.status);
                      return (
                        <tr key={i.id} className={`border-b border-slate-100 last:border-0 hover:bg-slate-50 ${selected.has(i.id) ? 'bg-brand-50' : ''}`}>
                          <td className="p-3"><input type="checkbox" aria-label={`Select ${i.title}`} checked={selected.has(i.id)} onChange={() => toggle(i.id)} className="size-4 accent-[#14856e]" /></td>
                          <td className="p-3 text-slate-400">#CS-{i.id}</td>
                          <td className="p-3"><Link to={`/admin/issues/${i.id}`} className="flex items-center gap-3"><ModuleTile module={i.category.module} size={36} /><span><b className="block text-slate-900">{i.title}</b><span className="text-xs text-slate-500">{MODULE_LABELS[i.category.module]}</span></span></Link></td>
                          <td className="p-3 text-slate-500">{i.addressText || i.ward || '—'}</td>
                          <td className="p-3"><StatusBadge status={i.status} /></td>
                          <td className="p-3">{i.assigneeName ? <span title={i.assigneeName}><Avatar name={i.assigneeName} size={28} /></span> : <span className="text-slate-400">Unassigned</span>}</td>
                          <td className={`p-3 font-semibold ${sla.tone}`}>{sla.text}</td>
                          <td className="p-3 text-slate-500">{ago(i.createdAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </Card>
              <div className="mt-4 flex items-center justify-between text-sm text-slate-500">
                <span>{page * PAGE + 1}–{Math.min((page + 1) * PAGE, data.total)} of {data.total}</span>
                <span className="flex items-center gap-1">
                  <button type="button" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="grid size-11 place-items-center rounded-xl hover:bg-slate-100 disabled:opacity-40"><ChevronLeft size={18} /></button>
                  {page + 1} / {pages}
                  <button type="button" disabled={page + 1 >= pages} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="grid size-11 place-items-center rounded-xl hover:bg-slate-100 disabled:opacity-40"><ChevronRight size={18} /></button>
                </span>
              </div>
            </>
          )}
        </>
      )}

      <Modal open={Boolean(assigning)} onClose={() => setAssigning(null)} title="Assign to…">
        {assigning && <AssignModal issue={assigning} onClose={() => setAssigning(null)} onDone={() => { setAssigning(null); setKey((k) => k + 1); }} />}
      </Modal>
    </>
  );
}