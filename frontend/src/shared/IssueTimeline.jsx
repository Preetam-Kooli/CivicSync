import { STATUS_ORDER, STATUS_LABELS, formatDateTime } from './issueUi.js';

export default function IssueTimeline({ status, events }) {
  const current = STATUS_ORDER.indexOf(status);

  return (
    <div>
      <ol className="flex gap-1" aria-label="Progress">
        {STATUS_ORDER.map((s, i) => (
          <li key={s} className="flex-1">
            <div className={`h-1.5 rounded-full ${i <= current ? 'bg-emerald-500' : 'bg-slate-200'}`} />
            <span className={`mt-1 block text-[11px] leading-tight ${i === current ? 'font-semibold text-slate-800' : 'text-slate-500'}`}>
              {STATUS_LABELS[s]}
            </span>
          </li>
        ))}
      </ol>

      <ul className="mt-5 space-y-4 border-l-2 border-slate-200 pl-4">
        {[...events].reverse().map((e) => (
          <li key={e.id}>
            <p className="text-sm font-medium text-slate-800">
              {e.from && e.from !== e.to
                ? `${STATUS_LABELS[e.from]} → ${STATUS_LABELS[e.to]}`
                : e.from
                  ? 'Update'
                  : 'Reported'}
            </p>
            {e.note && <p className="text-sm text-slate-600">{e.note}</p>}
            <p className="text-xs text-slate-500">
              {formatDateTime(e.at)}
              {e.by ? ` · ${e.by}` : ''}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}