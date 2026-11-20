import { Check } from 'lucide-react';
import { MODULE_ICON, MODULE_TILE } from './moduleIcons.js';

export const Card = ({ className = '', ...p }) => (
  <section className={`rounded-2xl border border-slate-200/70 bg-white p-5 shadow-sm ${className}`} {...p} />
);

const TONES = {
  green: 'bg-emerald-50 text-emerald-700', red: 'bg-red-50 text-red-700', amber: 'bg-amber-50 text-amber-800',
  blue: 'bg-sky-50 text-sky-700', violet: 'bg-violet-50 text-violet-700', orange: 'bg-orange-50 text-orange-700',
  slate: 'bg-slate-100 text-slate-600',
};
export const Badge = ({ tone = 'slate', className = '', ...p }) => (
  <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${TONES[tone]} ${className}`} {...p} />
);

export function Avatar({ name = '?', size = 36 }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  return (
    <span aria-hidden="true" className="inline-grid shrink-0 place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.38, background: 'linear-gradient(135deg,#14856e,#23a98e)' }}>
      {initials}
    </span>
  );
}

export const Skeleton = ({ className = '' }) => <div className={`animate-pulse rounded-xl bg-slate-200/80 ${className}`} />;

export function EmptyState({ icon: Icon = Check, title, children, action }) {
  return (
    <div className="grid place-items-center px-4 py-14 text-center">
      <span className="grid size-16 place-items-center rounded-full bg-brand-50 text-brand-600"><Icon size={28} /></span>
      <p className="mt-4 text-lg font-semibold text-slate-800">{title}</p>
      {children && <p className="mt-1 max-w-sm text-sm text-slate-500">{children}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-xl bg-slate-100 p-1">
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}
          className={`min-h-10 rounded-lg px-3 text-sm font-semibold transition ${value === o.value ? 'bg-white text-brand-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ModuleTile({ module, size = 40 }) {
  const Icon = MODULE_ICON[module] || MODULE_ICON.public_service;
  return (
    <span className={`grid shrink-0 place-items-center rounded-xl ${MODULE_TILE[module] || MODULE_TILE.public_service}`} style={{ width: size, height: size }}>
      <Icon size={Math.round(size * 0.5)} />
    </span>
  );
}