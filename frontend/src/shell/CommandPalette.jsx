import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ListChecks, Search } from 'lucide-react';
import { api } from '../lib/api.js';
import { Modal } from '../ui/Overlay.jsx';
import { PORTALS, isVisible } from './nav.js';

function Body({ portal, role, onClose }) {
  const navigate = useNavigate();
  const [q, setQ] = useState('');
  const [found, setFound] = useState([]);
  const term = q.trim().toLowerCase();

  const pages = useMemo(
    () => PORTALS[portal].groups.flatMap((g) => g.items).filter((i) => isVisible(i, role)),
    [portal, role]
  );
  const matches = pages.filter((p) => p.label.toLowerCase().includes(term));

  useEffect(() => {
    if (portal !== 'admin' || term.length < 2) return;
    const id = setTimeout(() => {
      api('GET', `/api/admin/issue-list?limit=5&q=${encodeURIComponent(term)}`)
        .then((d) => setFound(d.issues))
        .catch(() => {});
    }, 250);
    return () => clearTimeout(id);
  }, [term, portal]);

  const issues = term.length >= 2 ? found : [];
  const go = (to) => {
    onClose();
    navigate(to);
  };

  return (
    <form onSubmit={(e) => { e.preventDefault(); const first = matches[0]?.to || (issues[0] && `/admin/issues/${issues[0].id}`); if (first) go(first); }}>
      <div className="flex items-center gap-3 border-b border-slate-200 pb-3">
        <Search size={18} className="text-slate-400" />
        <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search"
          placeholder={portal === 'admin' ? 'Search pages and issues…' : 'Search pages…'}
          className="min-h-11 w-full bg-transparent text-base outline-none" />
        <kbd className="rounded-md border border-slate-300 px-1.5 py-0.5 text-[11px] text-slate-500">Esc</kbd>
      </div>
      <div className="mt-3 max-h-80 overflow-y-auto">
        {matches.length > 0 && <p className="px-2 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Pages</p>}
        {matches.map((p) => (
          <button key={p.to} type="button" onClick={() => go(p.to)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm hover:bg-slate-100">
            <p.icon size={18} className="text-brand-600" /> {p.label}
          </button>
        ))}
        {issues.length > 0 && <p className="px-2 pb-1 pt-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">Issues</p>}
        {issues.map((i) => (
          <button key={i.id} type="button" onClick={() => go(`/admin/issues/${i.id}`)} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left text-sm hover:bg-slate-100">
            <ListChecks size={18} className="text-brand-600" />
            <span className="min-w-0 flex-1 truncate">{i.title}</span>
            <span className="text-xs text-slate-400">#CS-{i.id}</span>
          </button>
        ))}
        {matches.length === 0 && issues.length === 0 && <p className="px-2 py-6 text-center text-sm text-slate-500">Nothing found.</p>}
      </div>
    </form>
  );
}

export default function CommandPalette({ open, onClose, portal, role }) {
  return (
    <Modal open={open} onClose={onClose} sheet={false} className="mb-auto mt-[12vh] max-w-xl">
      <Body portal={portal} role={role} onClose={onClose} />
    </Modal>
  );
}