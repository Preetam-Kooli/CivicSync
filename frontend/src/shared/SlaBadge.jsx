import { useEffect, useState } from 'react';

function format(ms) {
  const mins = Math.floor(Math.abs(ms) / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

export default function SlaBadge({ deadline, status, escalationLevel = 0 }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  if (status === 'resolved' || !deadline) return null;

  const ms = new Date(deadline).getTime() - now;
  const overdue = ms < 0;

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
        overdue ? 'bg-red-50 text-red-700' : 'bg-slate-100 text-slate-700'
      }`}
    >
      {overdue ? `Overdue by ${format(ms)}` : `Due in ${format(ms)}`}
      {escalationLevel > 0 ? ` · Escalated (level ${escalationLevel})` : ''}
    </span>
  );
}