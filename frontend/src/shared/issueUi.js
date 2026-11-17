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