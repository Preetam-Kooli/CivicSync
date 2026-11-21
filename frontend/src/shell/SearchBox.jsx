import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { PORTALS, isVisible } from './nav.js';

// The top-bar search: it is a real input, and the results drop down directly under it
export default function SearchBox({ portal, role, inputRef }) {
  const navigate = useNavigate();
  const wrap = useRef(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const term = q.trim().toLowerCase();

  const pages = useMemo(
    () => PORTALS[portal].groups.flatMap((g) => g.items).filter((i) => isVisible(i, role)),
    [portal, role]
  );
  const matches = pages.filter((p) => p.label.toLowerCase().includes(term));
  const issues = term.length >= 2 ? found : [];

  useEffect(() => {
    if (portal !== 'admin' || term.length < 2) return;
    const id = setTimeout(() => {
      api('GET', `/api/admin/issue-list?limit=5&q=${encodeURIComponent(term)}`).then((d) => setFound(d.issues)).catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [term, portal]);

  useEffect(() => {
    if (!open) return;
    const away = (e) => {
      if (!wrap.current?.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', away);
    return () => document.removeEventListener('mousedown', away);
  }, [open]);

  const go = (to) => {
    setOpen(false);
    setQ('');
    inputRef.current?.blur();
    navigate(to);
  };
  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      inputRef.current?.blur();
    }
    if (e.key === 'Enter') {
      const to = matches[0]?.to || (issues[0] && `/admin/issues/${issues[0].id}`);
      if (to) go(to);
    }
  };

  const label = 'text-[11px] font-semibold uppercase tracking-wider text-slate-400';
  return (
    <div ref={wrap} className="relative w-full max-w-xl">
      <label className="relative block">
        <Search size={18} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          value={q}
          onFocus={() => setOpen(true)}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onKeyDown={onKeyDown}
          aria-label="Search"
          placeholder={portal === 'admin' ? 'Search issues and pages…' : 'Search pages…'}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-16 text-sm outline-none focus:border-brand-500 focus:bg-white"
        />
        <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-400">Ctrl K</kbd>
      </label>

      {open && (
        <div className="absolute left-0 top-[calc(100%+8px)] z-50 w-full overflow-hidden rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
          <div className="max-h-80 overflow-y-auto">
            {matches.length > 0 && <p className={`px-2 pb-1 pt-1 ${label}`}>Pages</p>}
            {matches.map((p) => (
              <button key={p.to} type="button" onClick={() => go(p.to)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm hover:bg-slate-100">
                <p.icon size={18} className="text-brand-600" /> {p.label}
              </button>
            ))}
            {issues.length > 0 && <p className={`px-2 pb-1 pt-3 ${label}`}>Issues</p>}
            {issues.map((i) => (
              <button key={i.id} type="button" onClick={() => go(`/admin/issues/${i.id}`)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm hover:bg-slate-100">
                <ListChecks size={18} className="text-brand-600" />
                <span className="min-w-0 flex-1 truncate">{i.title}</span>
                <span className="text-xs text-slate-400">#CS-{i.id}</span>
              </button>
            ))}
            {matches.length === 0 && issues.length === 0 && <p className="px-2 py-5 text-center text-sm text-slate-500">Nothing found.</p>}
          </div>
        </div>
      )}
    </div>
  );
}