import { useCallback, useEffect, useState } from 'react';
import { api } from '../../lib/api.js';
import StatusBadge from '../../shared/StatusBadge.jsx';
import SlaBadge from '../../shared/SlaBadge.jsx';
import { MODULES, MODULE_LABELS } from '../../shared/mapConfig.js';
import { STATUS_ORDER, STATUS_LABELS, formatDate } from '../../shared/issueUi.js';

const selectClass = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base';

export default function IssuesPage() {
  const [issues, setIssues] = useState(null);
  const [status, setStatus] = useState('');
  const [module, setModule] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params = new URLSearchParams();
    if (status) params.set('status', status);
    if (module) params.set('module', module);
    try {
      const data = await api('GET', `/api/admin/issues?${params}`);
      setIssues(data.issues);
      setError('');
    } catch (err) {
      setError(err.message);
    }
  }, [status, module]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">Issues</h1>

      <div className="flex flex-wrap gap-2">
        <select aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)} className={selectClass}>
          <option value="">All statuses</option>
          {STATUS_ORDER.map((s) => (
            <option key={s} value={s}>{STATUS_LABELS[s]}</option>
          ))}
        </select>
        <select aria-label="Filter by area" value={module} onChange={(e) => setModule(e.target.value)} className={selectClass}>
          <option value="">All areas</option>
          {MODULES.map((m) => (
            <option key={m.id} value={m.id}>{m.label}</option>
          ))}
        </select>
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!issues && !error && <p className="text-slate-500">Loading…</p>}
      {issues?.length === 0 && <p className="text-slate-500">No issues match.</p>}

      <ul className="space-y-3">
        {issues?.map((i) => (
          <li key={i.id} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-medium text-slate-800">{i.title}</p>
                <p className="text-sm text-slate-500">
                  {i.category.name} · {MODULE_LABELS[i.category.module]} · {formatDate(i.createdAt)}
                </p>
              </div>
              <span className="rounded-lg bg-slate-800 px-2 py-1 text-sm font-semibold text-white" title="Priority score">
                {Math.round(i.priorityScore)}
              </span>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              <StatusBadge status={i.status} />
              <SlaBadge deadline={i.slaDeadline} status={i.status} escalationLevel={i.escalationLevel} />
              {i.duplicateCount > 1 && (
                <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-medium text-orange-700">
                  {i.duplicateCount} reports
                </span>
              )}
              {i.assigneeName && <span className="text-xs text-slate-500">Assigned to {i.assigneeName}</span>}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}