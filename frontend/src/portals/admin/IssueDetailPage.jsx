import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, Camera, Check, MapPin } from 'lucide-react';
import { api } from '../../lib/api.js';
import { compressImage } from '../../lib/imageCompress.js';
import { useToast } from '../../ui/toastContext.js';
import PageHeader from '../../shell/PageHeader.jsx';
import Button from '../../ui/Button.jsx';
import { Avatar, Badge, Card, ModuleTile, Skeleton } from '../../ui/Surface.jsx';
import { Modal } from '../../ui/Overlay.jsx';
import StatusBadge from '../../shared/StatusBadge.jsx';
import SlaBadge from '../../shared/SlaBadge.jsx';
import { MODULE_LABELS } from '../../shared/mapConfig.js';
import { SEVERITY_LABELS, STATUS_LABELS, STATUS_ORDER, formatDateTime } from '../../shared/issueUi.js';
import { ROLE_LABELS } from './constants.js';

const DOT = { reported: 'bg-sky-500', verified: 'bg-violet-500', assigned: 'bg-amber-500', in_progress: 'bg-orange-500', resolved: 'bg-emerald-500' };
const Photo = ({ src, label }) => src && (
  <figure><img src={src} alt={label} loading="lazy" className="aspect-video w-full rounded-xl border border-slate-200 object-cover" /><figcaption className="mt-1 text-center text-xs text-slate-500">{label}</figcaption></figure>
);

export default function IssueDetailPage() {
  const { id } = useParams();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [key, setKey] = useState(0);
  const [dialog, setDialog] = useState('');
  const [busy, setBusy] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);

  useEffect(() => {
    let off = false;
    api('GET', `/api/admin/issues/${id}`)
      .then((d) => { if (!off) { setData(d); setError(''); } })
      .catch((e) => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [id, key]);

  async function send(to, extra = {}) {
    setBusy(true);
    try {
      let body;
      if (to === 'resolved') {
        body = new FormData();
        body.append('to', to);
        if (note) body.append('note', note);
        body.append('photo', photo);
      } else {
        body = { to, ...(note ? { note } : {}), ...extra };
      }
      await api('POST', `/api/admin/issues/${id}/transition`, body);
      toast(to === 'resolved' ? 'Issue resolved' : 'Issue updated');
      setDialog(''); setNote(''); setPhoto(null); setAssigneeId('');
      setKey((k) => k + 1);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function pickPhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try { setPhoto(await compressImage(file)); } catch (err) { toast(err.message, 'error'); }
  }

  if (error && !data) return <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!data) return <div className="space-y-3"><Skeleton className="h-12 w-2/3" /><Skeleton className="h-64" /></div>;

  const { issue, timeline, assignees, nextStatus } = data;
  const step = STATUS_ORDER.indexOf(issue.status);
  const act = () => (nextStatus === 'assigned' ? setDialog('assign') : nextStatus === 'resolved' ? setDialog('resolve') : send(nextStatus));
  const actLabel = nextStatus === 'resolved' ? 'Mark resolved' : nextStatus === 'assigned' ? 'Assign' : `Mark as ${STATUS_LABELS[nextStatus]?.toLowerCase()}`;
  const canReassign = ['assigned', 'in_progress'].includes(issue.status);

  return (
    <>
      <PageHeader title={issue.title} subtitle={`#CS-${issue.id} · ${issue.category.name}`}
        actions={nextStatus && <Button className="hidden lg:inline-flex" icon={Check} onClick={act} loading={busy}>{actLabel}</Button>} />
      <Link to="/admin/issues" className="mb-3 inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-brand-700"><ArrowLeft size={16} />All issues</Link>

      <div className="grid gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          <Card>
            <div className="flex items-start gap-3">
              <ModuleTile module={issue.category.module} size={48} />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold text-slate-900 lg:hidden">{issue.title}</h2>
                <p className="flex items-center gap-1 text-sm text-slate-500"><MapPin size={14} />{issue.addressText || `${issue.location.lat.toFixed(5)}, ${issue.location.lng.toFixed(5)}`} · {MODULE_LABELS[issue.category.module]}</p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <StatusBadge status={issue.status} />
                  <SlaBadge deadline={issue.slaDeadline} status={issue.status} escalationLevel={issue.escalationLevel} />
                  {issue.duplicateCount > 1 && <Badge tone="orange">{issue.duplicateCount} reports</Badge>}
                  {issue.reopenCount > 0 && <Badge tone="red">Reopened {issue.reopenCount}×</Badge>}
                </div>
              </div>
            </div>
            {issue.description && <p className="mt-4 text-slate-700">{issue.description}</p>}
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              {[['Priority', Math.round(issue.priorityScore)], ['Severity', SEVERITY_LABELS[issue.severity]], ['Ward', issue.ward || '—'], ['Reported', formatDateTime(issue.createdAt)]].map(([k, v]) => (
                <div key={k}><dt className="text-xs uppercase tracking-wider text-slate-400">{k}</dt><dd className="font-semibold text-slate-900">{v}</dd></div>
              ))}
            </dl>
            {(issue.photoUrl || issue.afterPhotoUrl) && <div className="mt-4 grid grid-cols-2 gap-3"><Photo src={issue.photoUrl} label="Before" /><Photo src={issue.afterPhotoUrl} label="After" /></div>}
          </Card>

          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">Activity</h2>
            <ul className="space-y-5 border-l-2 border-slate-200 pl-5">
              {[...timeline].reverse().map((e) => (
                <li key={e.id} className="relative">
                  <span className={`absolute -left-[27px] top-1 size-3 rounded-full ring-4 ring-[var(--card)] ${DOT[e.to]}`} />
                  <p className="text-sm font-semibold text-slate-900">{e.from && e.from !== e.to ? `${STATUS_LABELS[e.from]} → ${STATUS_LABELS[e.to]}` : e.from ? 'Update' : 'Reported'}</p>
                  {e.note && <p className="text-sm text-slate-600">{e.note}</p>}
                  <p className="text-xs text-slate-400">{formatDateTime(e.at)}{e.by ? ` · by ${e.by}` : ''}</p>
                </li>
              ))}
            </ul>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <h2 className="mb-4 font-semibold text-slate-900">Progress</h2>
            <ol className="space-y-3">
              {STATUS_ORDER.map((s, i) => (
                <li key={s} className="flex items-center gap-3">
                  <span className={`grid size-7 place-items-center rounded-full text-white ${i <= step ? 'bg-brand-600' : 'bg-slate-300'}`}>{i <= step ? <Check size={15} /> : i + 1}</span>
                  <span className={`text-sm ${i === step ? 'font-bold text-slate-900' : 'text-slate-500'}`}>{STATUS_LABELS[s]}</span>
                </li>
              ))}
            </ol>
          </Card>
          <Card>
            <p className="text-xs uppercase tracking-wider text-slate-400">Assigned to</p>
            {issue.assigneeName ? (
              <div className="mt-2 flex items-center gap-3"><Avatar name={issue.assigneeName} size={40} /><b className="flex-1 text-slate-900">{issue.assigneeName}</b>{canReassign && <button type="button" onClick={() => setDialog('assign')} className="min-h-11 px-2 text-sm font-semibold text-brand-700">Change</button>}</div>
            ) : <p className="mt-2 text-sm text-slate-500">Not assigned yet.</p>}
            {nextStatus && (
              <div className="mt-4 hidden border-t border-slate-200 pt-4 lg:block">
                <input aria-label="Note (optional)" placeholder="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="mb-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" />
                <Button className="w-full" onClick={act} loading={busy}>{actLabel}</Button>
              </div>
            )}
          </Card>
        </div>
      </div>

      {nextStatus && (
        <div className="glass fixed inset-x-3 bottom-24 z-30 rounded-2xl border border-slate-200 p-2 shadow-lg lg:hidden">
          <Button className="w-full" icon={Check} onClick={act} loading={busy}>{actLabel}</Button>
        </div>
      )}

      <Modal open={dialog === 'assign'} onClose={() => setDialog('')} title="Assign to…">
        <select aria-label="Assign to" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className="min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base">
          <option value="">Choose a person…</option>
          {assignees.map((a) => <option key={a.id} value={a.id}>{a.fullName} ({ROLE_LABELS[a.role]})</option>)}
        </select>
        <div className="mt-4 grid grid-cols-2 gap-3"><Button variant="secondary" onClick={() => setDialog('')}>Cancel</Button><Button disabled={!assigneeId} loading={busy} onClick={() => send(canReassign ? issue.status : 'assigned', { assigneeId: Number(assigneeId) })}>Save</Button></div>
      </Modal>

      <Modal open={dialog === 'resolve'} onClose={() => setDialog('')} title="Mark as resolved">
        <p className="mb-3 text-sm text-slate-500">An "after" photo is required as proof.</p>
        <label className="flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-slate-300 text-sm font-semibold text-slate-600">
          <Camera size={18} />{photo ? `Photo ready (${Math.round(photo.size / 1024)} KB). Change` : 'Take or choose photo'}
          <input type="file" accept="image/*" capture="environment" onChange={pickPhoto} className="sr-only" />
        </label>
        <input aria-label="Note (optional)" placeholder="Note (optional)" maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} className="mt-3 min-h-11 w-full rounded-xl border border-slate-300 bg-white px-3 text-base" />
        <div className="mt-4 grid grid-cols-2 gap-3"><Button variant="secondary" onClick={() => setDialog('')}>Cancel</Button><Button disabled={!photo} loading={busy} onClick={() => send('resolved')}>Resolve</Button></div>
      </Modal>
    </>
  );
}