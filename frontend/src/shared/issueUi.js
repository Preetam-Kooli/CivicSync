export const STATUS_ORDER = ['reported', 'verified', 'assigned', 'in_progress', 'resolved'];

export const STATUS_LABELS = {
  reported: 'Reported',
  verified: 'Verified',
  assigned: 'Assigned',
  in_progress: 'In progress',
  resolved: 'Resolved',
};

export const STATUS_STYLES = {
  reported: 'bg-slate-100 text-slate-700',
  verified: 'bg-sky-50 text-sky-700',
  assigned: 'bg-violet-50 text-violet-700',
  in_progress: 'bg-amber-50 text-amber-800',
  resolved: 'bg-emerald-50 text-emerald-700',
};

export const SEVERITY_LABELS = ['', 'Minor', 'Low', 'Moderate', 'High', 'Critical'];

export const formatDate = (iso) =>
  new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export const formatDateTime = (iso) =>
  new Date(iso).toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

export function formatHours(h) {
  if (h === null || h === undefined) return '—';
  if (h < 1) return `${Math.round(h * 60)} min`;
  if (h < 48) return `${Math.round(h * 10) / 10} h`;
  return `${Math.round((h / 24) * 10) / 10} days`;
}

// "2026-11" -> "Nov 26"
export function monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short', year: '2-digit' });
}