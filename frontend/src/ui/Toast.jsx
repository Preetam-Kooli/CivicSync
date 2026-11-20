import { useCallback, useState } from 'react';
import { Check, Info, TriangleAlert } from 'lucide-react';
import { ToastContext } from './toastContext.js';

const ICONS = { success: Check, error: TriangleAlert, info: Info };
let nextId = 1;

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const toast = useCallback((message, tone = 'success') => {
    const id = nextId++;
    setItems((l) => [...l, { id, message, tone }]);
    setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 4000);
  }, []);

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-28 z-[70] flex flex-col items-center gap-2 px-4 lg:bottom-6">
        {items.map((t) => {
          const Icon = ICONS[t.tone] || Check;
          return (
            <div key={t.id} role="status" className={`pointer-events-auto flex max-w-md items-center gap-2 rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${t.tone === 'error' ? 'bg-red-600' : 'bg-[#0b2427]'}`}>
              <Icon size={18} className="shrink-0" />
              {t.message}
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}