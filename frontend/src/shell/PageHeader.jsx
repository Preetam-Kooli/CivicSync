import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useShell } from './shellContext.js';

// Desktop: big title with actions on the right. Phone: the title moves into the top bar.
export default function PageHeader({ title, subtitle, actions }) {
  const { setMeta } = useShell();
  const { pathname } = useLocation();
  useEffect(() => {
    setMeta({ path: pathname, title, subtitle });
  }, [pathname, title, subtitle, setMeta]);

  return (
    <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
      <div className="hidden lg:block">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}