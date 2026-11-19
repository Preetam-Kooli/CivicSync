import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';

const STYLES = {
  critical: 'bg-red-700 text-white',
  warning: 'bg-amber-100 text-amber-950',
  info: 'bg-sky-100 text-sky-950',
};
const KIND_LABELS = { flood: 'Flood', road_closure: 'Road closure', fire: 'Fire', weather: 'Weather', general: 'Notice' };
const KEY = 'civicsync_dismissed_alerts';

function readDismissed() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || '[]');
  } catch {
    return [];
  }
}

// Shown at the very top of every page, signed in or not. Polls once a minute.
export default function AlertBanner() {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let cancelled = false;
    const load = () =>
      api('GET', '/api/public/alerts')
        .then((d) => {
          if (!cancelled) setAlerts(d.alerts);
        })
        .catch(() => {});
    load();
    const timer = setInterval(load, 60_000);
    const onVisible = () => document.visibilityState === 'visible' && load();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  function dismiss(id) {
    const next = [...dismissed, id];
    setDismissed(next);
    try {
      sessionStorage.setItem(KEY, JSON.stringify(next));
    } catch {
      /* storage unavailable: the alert simply hides until the next reload */
    }
  }

  // Critical alerts cannot be dismissed
  const shown = alerts.filter((a) => a.severity === 'critical' || !dismissed.includes(a.id));
  if (shown.length === 0) return null;

  return (
    <div role="region" aria-label="Emergency alerts">
      {shown.map((a) => (
        <div
          key={a.id}
          role={a.severity === 'critical' ? 'alert' : 'status'}
          className={`flex items-start gap-3 px-4 py-3 pt-[calc(0.75rem+env(safe-area-inset-top))] ${STYLES[a.severity]}`}
        >
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-semibold">
              {KIND_LABELS[a.kind]}: {a.title}
            </p>
            <p className="mt-0.5">{a.message}</p>
          </div>
          {a.severity !== 'critical' && (
            <button
              type="button"
              onClick={() => dismiss(a.id)}
              aria-label={`Dismiss alert: ${a.title}`}
              className="grid size-11 shrink-0 place-items-center rounded-lg text-xl hover:bg-black/10"
            >
              ×
            </button>
          )}
        </div>
      ))}
    </div>
  );
}