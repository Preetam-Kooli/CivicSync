import { useEffect, useRef, useState } from 'react';
import Button from './Button.jsx';

// On phones this slides up as a bottom sheet; on larger screens it is a centred dialog
export function Modal({ open, onClose, title, children, sheet = true, className = '' }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={title}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      className={`w-full max-w-md rounded-3xl bg-white p-0 text-slate-800 shadow-2xl ${sheet ? 'max-sm:m-0 max-sm:mt-auto max-sm:max-w-none max-sm:rounded-b-none' : ''} ${className}`}
    >
      {open && (
        <div className="p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))]">
          {title && <h2 className="mb-3 text-lg font-semibold">{title}</h2>}
          {children}
        </div>
      )}
    </dialog>
  );
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', danger = false, busy = false, onConfirm, onCancel }) {
  return (
    <Modal open={open} onClose={onCancel} title={title}>
      <p className="text-sm text-slate-600">{message}</p>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button variant="secondary" onClick={onCancel}>Cancel</Button>
        <Button variant={danger ? 'danger' : 'primary'} loading={busy} onClick={onConfirm}>{confirmLabel}</Button>
      </div>
    </Modal>
  );
}

// button is a function: button({ toggle, open }) returns the trigger element
export function Menu({ button, children, align = 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const away = (e) => !ref.current?.contains(e.target) && setOpen(false);
    const esc = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', away);
    document.addEventListener('keydown', esc);
    return () => {
      document.removeEventListener('mousedown', away);
      document.removeEventListener('keydown', esc);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      {button({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div role="menu" onClick={() => setOpen(false)}
          className={`absolute z-50 mt-2 min-w-52 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-xl ${align === 'right' ? 'right-0' : 'left-0'}`}>
          {children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, danger = false, children, ...rest }) {
  return (
    <button type="button" role="menuitem" {...rest}
      className={`flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-medium hover:bg-slate-100 ${danger ? 'text-red-600' : 'text-slate-700'}`}>
      {Icon && <Icon size={18} />}
      {children}
    </button>
  );
}