import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../auth/useAuth.js';
import { api } from '../../lib/api.js';
import HotspotMap from '../../shared/HotspotMap.jsx';
import { MODULES, MODULE_LABELS } from '../../shared/mapConfig.js';

const select = 'min-h-11 rounded-lg border border-slate-300 bg-white px-3 text-base';

export default function HotspotsPage() {
  const { session } = useAuth();
  const isStaff = session.user.role === 'staff';
  const [filters, setFilters] = useState({ days: '180', cell: '250', min: '3', module: '' });
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const params = new URLSearchParams({ days: filters.days, cell: filters.cell, min: filters.min });
    if (filters.module) params.set('module', filters.module);
    api('GET', `/api/admin/hotspots?${params}`)
      .then((d) => {
        if (cancelled) return;
        setData(d);
        setError('');
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, [filters]);

  const set = (name) => (e) => setFilters((f) => ({ ...f, [name]: e.target.value }));
  const top = useMemo(() => (data ? data.features.slice(0, 10) : []), [data]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-slate-800">Hotspots</h1>
      <p className="text-sm text-slate-600">
        Reports are grouped into square map cells. A cell scores higher with more reports, more recent reports, and
        problems that keep coming back in different months. Tap a cell on the map for details.
      </p>

      <div className="flex flex-wrap gap-2">
        <select aria-label="Time window" value={filters.days} onChange={set('days')} className={select}>
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
          <option value="180">Last 6 months</option>
          <option value="365">Last year</option>
        </select>
        <select aria-label="Cell size" value={filters.cell} onChange={set('cell')} className={select}>
          <option value="100">100 m cells</option>
          <option value="250">250 m cells</option>
          <option value="500">500 m cells</option>
        </select>
        <select aria-label="Minimum issues per cell" value={filters.min} onChange={set('min')} className={select}>
          <option value="2">At least 2 issues</option>
          <option value="3">At least 3 issues</option>
          <option value="5">At least 5 issues</option>
        </select>
        {!isStaff && (
          <select aria-label="Area" value={filters.module} onChange={set('module')} className={select}>
            <option value="">All areas</option>
            {MODULES.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        )}
      </div>

      {error && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      <HotspotMap collection={data} />

      {data && data.features.length === 0 && (
        <p className="text-slate-500">No cell has that many reports in this window. Try a larger cell or a lower minimum.</p>
      )}

      <ul className="space-y-3">
        {top.map((f, i) => {
          const p = f.properties;
          return (
            <li key={i} className="rounded-2xl bg-white p-4 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="font-medium text-slate-800">
                  {p.topCategory} <span className="text-sm text-slate-500">({MODULE_LABELS[p.topModule]})</span>
                </p>
                <span className="rounded-lg bg-slate-800 px-2 py-1 text-sm font-semibold text-white" title="Hotspot score">{p.score}</span>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {p.issues} issues · {p.reports} reports · {p.recent} in the last 30 days · seen in {p.monthsActive} month{p.monthsActive === 1 ? '' : 's'}
              </p>
              <p className={`mt-2 text-sm ${p.recurring ? 'font-medium text-orange-700' : 'text-slate-500'}`}>
                {p.recurring ? 'Recurring problem area: plan preventive maintenance.' : 'Keep an eye on this area.'}
              </p>
            </li>
          );
        })}
      </ul>
    </div>
  );
}