import { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../../lib/api.js';
import StatusBadge from '../../shared/StatusBadge.jsx';
import SlaBadge from '../../shared/SlaBadge.jsx';
import IssueTimeline from '../../shared/IssueTimeline.jsx';
import { MODULE_LABELS } from '../../shared/mapConfig.js';
import { SEVERITY_LABELS, formatDate } from '../../shared/issueUi.js';

function Photo({ src, label }) {
  if (!src) return null;
  return (
    <figure>
      <img src={src} alt={label} loading="lazy" className="w-full rounded-lg border border-slate-200 object-cover" />
      <figcaption className="mt-1 text-center text-xs text-slate-500">{label}</figcaption>
    </figure>
  );
}

export default function ReportDetailPage() {
  const { id } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setData(await api('GET', `/api/citizen/issues/${id}`));
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(action, body) {
    setBusy(true);
    setError('');
    try {
      await api('POST', `/api/citizen/issues/${id}/${action}`, body);
      await load();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  function reopen() {
    const note = window.prompt('What is still wrong? (optional)');
    if (note === null) return; // cancelled
    act('reopen', { note });
  }

  if (error && !data) {
    return <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>;
  }
  if (!data) return <p className="text-slate-500">Loading…</p>;

  const { issue, timeline, canConfirm } = data;

  return (
    <div className="space-y-5">
      <Link to="/citizen/reports" className="inline-block min-h-11 py-2 text-sm text-emerald-700 underline">
        ← My reports
      </Link>

      <section className="space-y-3 rounded-2xl bg-white p-5 shadow-sm">
        <h1 className="text-xl font-semibold text-slate-800">{issue.title}</h1>
        <div className="flex flex-wrap items-center gap-1.5">
          <StatusBadge status={issue.status} />
          <SlaBadge deadline={issue.slaDeadline} status={issue.status} escalationLevel={issue.escalationLevel} />
          {issue.duplicateCount > 1 && (
            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
              Reported by {issue.duplicateCount} people
            </span>
          )}
        </div>
        <p className="text-sm text-slate-500">
          {issue.category.name} · {MODULE_LABELS[issue.category.module]} · severity {SEVERITY_LABELS[issue.severity]} · {formatDate(issue.createdAt)}
        </p>
        {issue.description && <p className="text-slate-700">{issue.description}</p>}

        {(issue.photoUrl || issue.afterPhotoUrl) && (
          <div className="grid grid-cols-2 gap-3">
            <Photo src={issue.photoUrl} label="Before" />
            <Photo src={issue.afterPhotoUrl} label="After" />
          </div>
        )}
      </section>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {canConfirm && (
        <section className="space-y-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-medium text-emerald-900">The authorities say this is fixed. Is it?</p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={busy}
              onClick={() => act('confirm')}
              className="min-h-11 rounded-lg bg-emerald-600 px-4 font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Yes, it is fixed
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={reopen}
              className="min-h-11 rounded-lg border border-slate-300 bg-white px-4 hover:bg-slate-50 disabled:opacity-60"
            >
              No, reopen it
            </button>
          </div>
        </section>
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-800">Progress</h2>
        <IssueTimeline status={issue.status} events={timeline} />
      </section>
    </div>
  );
}