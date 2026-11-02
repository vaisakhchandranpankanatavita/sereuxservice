import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* Shared UI primitives: toasts, skeletons, empty states, badges and a focus-trapped drawer. */

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems((x) => [...x, { id, message, action: opts.action, tone: opts.tone || 'info' }]);
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), opts.duration || 4000);
  }, []);
  const dismiss = (id) => setItems((x) => x.filter((t) => t.id !== id));
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`toast toast-${t.tone}`}>
            <span>{t.message}</span>
            {t.action && <button type="button" onClick={() => { t.action.run(); dismiss(t.id); }}>{t.action.label}</button>}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  );
}

export const Skeleton = ({ w = '100%', h = 16, r }) => (
  <span className="skeleton" aria-hidden="true" style={{ width: w, height: h, borderRadius: r }} />
);

export const Tag = ({ tone = 'neutral', children }) => <span className={`tag tag-${tone}`}>{children}</span>;

export const EmptyState = ({ title, text, action }) => (
  <div className="empty-state">
    <h3>{title}</h3>
    {text && <p>{text}</p>}
    {action}
  </div>
);

export function Drawer({ open, onClose, title, children }) {
  const ref = useRef(null);
  const last = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    last.current = document.activeElement;
    const node = ref.current;
    const focusables = () => node.querySelectorAll('a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])');
    focusables()[0]?.focus();
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key !== 'Tab') return;
      const f = focusables();
      if (!f.length) return;
      const first = f[0], end = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); end.focus(); }
      else if (!e.shiftKey && document.activeElement === end) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
      last.current?.focus?.();
    };
  }, [open, onClose]);
  /* Portal out of the blurred sticky header, whose backdrop-filter would otherwise trap position:fixed. */
  return createPortal(
    <div className={`drawer-root${open ? ' open' : ''}`} aria-hidden={!open}>
      <div className="drawer-backdrop" onClick={onClose} />
      <aside ref={ref} className="drawer" role="dialog" aria-modal="true" aria-label={title} inert={!open}>
        <header><h2>{title}</h2><button type="button" onClick={onClose} aria-label="Close">×</button></header>
        <div className="drawer-body">{children}</div>
      </aside>
    </div>,
    document.body,
  );
}
