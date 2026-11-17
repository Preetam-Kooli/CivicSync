import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import { compressImage } from '../../lib/imageCompress.js';
import StatusBadge from '../../shared/StatusBadge.jsx';
import SlaBadge from '../../shared/SlaBadge.jsx';
import IssueTimeline from '../../shared/IssueTimeline.jsx';
import { MODULE_LABELS } from '../../shared/mapConfig.js';
import { SEVERITY_LABELS, STATUS_LABELS, formatDate } from '../../shared/issueUi.js';
import { ROLE_LABELS } from './constants.js';

const selectClass = 'min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-base';
const primary = 'min-h-11 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60';

function Photo({ src, label }) {
  if (!src) return null;
  return (
    <figure>
      <img src={src} alt={label} loading="lazy" className="w-full rounded-lg border border-slate-200 object-cover" />
      <figcaption className="mt-1 text-center text-xs text-slate-500">{label}</figcaption>
    </figure>
  );
}

export default function IssueDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [assigneeId, setAssigneeId] = useState('');
  const [note, setNote] = useState('');
  const [photo, setPhoto] = useState(null);

  const load = useCallback(async () => {
    try {
      setData(await api('GET', `/api/admin/issues/${id}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function submit(to) {
    setBusy(true);
    setError('');
    try {
      let body;
      if (to === 'resolved') {
        if (!photo) throw new Error('Add an "after" photo to resolve this issue');
        body = new FormData();
        body.append('to', to);
        if (note) body.append('note', note);
        body.append('photo', photo);
      } else {
        body = { to };
        if (assigneeId) body.assigneeId = Number(assigneeId);
        if (note) body.note = note;
      }
      await api('POST', `/api/admin/issues/${id}/transition`, body);
      setNote('');
      setPhoto(null);
      setAssigneeId('');
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      setPhoto(await compressImage(file));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }

  if (error && !data) return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  if (!data) return <p className="text-slate-500">Loading…</p>;

  const { issue, timeline, assignees, nextStatus } = data;
  const assigneeSelect = (
    <select aria-label="Assign to" value={assigneeId} onChange={(e) => setAssigneeId(e.target.value)} className={selectClass}>
      <option value="">Choose a person…</option>
      {assignees.map((a) => (
        <option key={a.id} value={a.id}>
          {a.fullName} ({ROLE_LABELS[a.role]})
        </option>
      ))}
    </select>
  );

  return (
    <div className="space-y-5">
      <Link to="/admin/issues" className="inline-block min-h-11 py-2 text-sm text-amber-800 underline">
        ← All issues
      </Link>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <h1 className="text-xl font-semibold text-slate-800">{issue.title}</h1>
          <span className="rounded-lg bg-slate-800 px-2 py-1 text-sm font-semibold text-white" title="Priority score">
            Priority {Math.round(issue.priorityScore)}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={issue.status} />
          <SlaBadge deadline={issue.slaDeadline} status={issue.status} escalationLevel={issue.escalationLevel} />
          {issue.duplicateCount > 1 && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
              {issue.duplicateCount} reports
            </span>
          )}
          {issue.reopenCount > 0 && (
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
              Reopened {issue.reopenCount}×
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">
          {issue.category.name} · {MODULE_LABELS[issue.category.module]} · severity {SEVERITY_LABELS[issue.severity]} · {formatDate(issue.createdAt)}
        </p>
        <p className="text-sm text-slate-500">
          Location: {issue.location.lat.toFixed(5)}, {issue.location.lng.toFixed(5)}
          {issue.assigneeName ? ` · Responsible: ${issue.assigneeName}` : ''}
        </p>
        {issue.description && <p className="text-slate-700">{issue.description}</p>}
        {(issue.photoUrl || issue.afterPhotoUrl) && (
          <div className="grid grid-cols-2 gap-3">
            <Photo src={issue.photoUrl} label="Before" />
            <Photo src={issue.afterPhotoUrl} label="After" />
          </div>
        )}
        {issue.status === 'resolved' && (
          <p className="text-sm text-slate-600">
            {issue.confirmedAt ? `Confirmed on ${formatDate(issue.confirmedAt)}.` : 'Waiting for the reporter to confirm (accepted automatically after 7 days).'}
          </p>
        )}
      </section>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {nextStatus && (
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Next step: {STATUS_LABELS[nextStatus]}</h2>

          {nextStatus === 'assigned' && assigneeSelect}

          {nextStatus === 'resolved' && (
            <div className="space-y-2">
              <p className="text-sm text-slate-600">An "after" photo is required.</p>
              <label className="inline-flex min-h-11 cursor-pointer items-center rounded-lg border border-slate-300 bg-white px-4 hover:bg-slate-50">
                {photo ? 'Change photo' : 'Take or choose photo'}
                <input type="file" accept="image/*" capture="environment" onChange={handlePhoto} className="sr-only" />
              </label>
              {photo && <p className="text-sm text-emerald-700">Photo ready ({Math.round(photo.size / 1024)} KB)</p>}
            </div>
          )}

          <input
            type="text"
            aria-label="Note (optional)"
            placeholder="Note (optional)"
            maxLength={500}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base"
          />

          <button type="button" disabled={busy} onClick={() => submit(nextStatus)} className={primary}>
            {busy ? 'Saving…' : `Mark as ${STATUS_LABELS[nextStatus].toLowerCase()}`}
          </button>
        </section>
      )}

      {['assigned', 'in_progress'].includes(issue.status) && (
        <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-800">Reassign</h2>
          {assigneeSelect}
          <button
            type="button"
            disabled={busy || !assigneeId}
            onClick={() => submit(issue.status)}
            className="min-h-11 rounded-lg border border-slate-300 px-4 hover:bg-slate-50 disabled:opacity-60"
          >
            Reassign
          </button>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Timeline</h2>
        <IssueTimeline status={issue.status} events={timeline} />
      </section>
    </div>
  );
}