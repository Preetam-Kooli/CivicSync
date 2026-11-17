import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../../lib/api.js';
import StatusBadge from '../../shared/StatusBadge.jsx';
import { MODULE_LABELS } from '../../shared/mapConfig.js';
import { formatDate } from '../../shared/issueUi.js';

export default function MyReportsPage() {
  const [issues, setIssues] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    api('GET', '/api/citizen/issues')
      .then((d) => setIssues(d.issues))
      .catch((err) => setError(err.message));
  }, []);

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold text-slate-800">My reports</h1>
      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {!issues && !error && <p className="text-slate-500">Loading…</p>}
      {issues?.length === 0 && (
        <p className="rounded-2xl bg-white p-6 text-slate-600 shadow-sm">
          You have not reported anything yet.{' '}
          <Link to="/citizen/report" className="font-medium text-emerald-700 underline">Report an issue</Link>
        </p>
      )}
      <ul className="space-y-3">
        {issues?.map((i) => (
          <li key={i.id} className="flex gap-3 rounded-2xl bg-white p-4 shadow-sm">
            {i.photoUrl && (
              <img src={i.photoUrl} alt="" width="64" height="64" loading="lazy" className="size-16 shrink-0 rounded-lg object-cover" />
            )}
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium text-slate-800">{i.title}</p>
              <p className="text-sm text-slate-500">
                {i.category.name} · {MODULE_LABELS[i.category.module]} · {formatDate(i.createdAt)}
              </p>
              <div className="mt-2">
                <StatusBadge status={i.status} />
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}