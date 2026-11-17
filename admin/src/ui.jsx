import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api.js';
import { LordIcon } from './LordIcon.jsx';

export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
export const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

const TONE = { DONE: 'ok', DELIVERED: 'ok', CONFIRMED: 'info', SHIPPED: 'info', ON_THE_WAY: 'info', IN_PROGRESS: 'warn', REQUESTED: 'warn', PLACED: 'warn', CANCELLED: 'bad', ADMIN: 'bad', PROVIDER: 'info' };
export const Badge = ({ v }) => <span className={`badge ${TONE[v] ?? ''}`}>{String(v).replace(/_/g, ' ').toLowerCase()}</span>;

const toaster = { set: null };
export function Toaster() {
  const [msg, setMsg] = useState('');
  useEffect(() => { toaster.set = (m) => { setMsg(m); setTimeout(() => setMsg(''), 3000); }; }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}
export const toast = (m) => toaster.set?.(m);

/* Load a list; `reload` refetches. Query params are folded into the path. */
export function useList(path, params = {}) {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');
  const qs = new URLSearchParams(Object.entries(params).filter(([, v]) => v)).toString();
  const url = qs ? `${path}?${qs}` : path;
  const seq = useRef(0);
  const reload = useCallback(async () => {
    const n = ++seq.current;
    try {
      const r = await api(url);
      if (n === seq.current) { setRows(r); setError(''); }
    } catch (e) {
      if (n === seq.current) setError(e.message);
    }
  }, [url]);
  useEffect(() => { reload(); }, [reload]);
  return { rows, error, reload };
}

/* Run a mutation, toast the result, then reload. */
export async function act(fn, ok, reload) {
  try { await fn(); if (ok) toast(ok); await reload?.(); return true; }
  catch (e) { toast(e.message); return false; }
}

export function Page({ title, actions, children }) {
  return <>
    <div className="head"><h1>{title}</h1><div className="grow" />{actions}</div>
    {children}
  </>;
}

export function Table({ cols, rows, error, empty = 'Nothing here yet.' }) {
  if (error) return <div className="card err">{error}</div>;
  if (!rows) return <div className="empty">Loading…</div>;
  return <div className="tablewrap">
    <table>
      <thead><tr>{cols.map((c, j) => <th key={j}>{c.h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={r.id ?? r.code ?? i}>{cols.map((c, j) => <td key={j} className={c.wrap ? 'wrap' : undefined}>{c.render(r)}</td>)}</tr>)}</tbody>
    </table>
    {!rows.length && <div className="empty">{empty}</div>}
  </div>;
}

export function Modal({ title, onClose, children }) {
  useEffect(() => {
    const k = (e) => e.key === 'Escape' && onClose();
    addEventListener('keydown', k);
    return () => removeEventListener('keydown', k);
  }, [onClose]);
  return <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
    <div className="modal" role="dialog" aria-modal="true" aria-label={title}><h2>{title}</h2>{children}</div>
  </div>;
}

/* fields: [{ key, label, type: text|number|textarea|bool|select|multi, options?, required?, locked? }] */
export function FormModal({ title, fields, initial = {}, onSubmit, onClose }) {
  const [v, setV] = useState(() => Object.fromEntries(fields.map((f) => [f.key, initial[f.key] ?? (f.type === 'bool' ? false : f.type === 'multi' ? [] : '')])));
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const set = (k, x) => setV((p) => ({ ...p, [k]: x }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true); setErr('');
    const out = {};
    for (const f of fields) {
      if (f.locked && initial[f.key] != null) continue;
      const x = v[f.key];
      if (f.type === 'number') out[f.key] = Number(x);
      else if (f.type === 'text' || f.type === 'textarea') { if (x !== '' || f.required !== false) out[f.key] = x; }
      else out[f.key] = x;
    }
    try { await onSubmit(out); onClose(); } catch (e2) { setErr(e2.message); setBusy(false); }
  };

  return <Modal title={title} onClose={onClose}>
    <form onSubmit={submit}>
      {fields.map((f) => <label className={f.type === 'bool' ? 'check field' : 'field'} key={f.key}>
        {f.type === 'bool'
          ? <><input type="checkbox" checked={v[f.key]} onChange={(e) => set(f.key, e.target.checked)} /> {f.label}</>
          : <>
            <span>{f.label}</span>
            {f.type === 'textarea' ? <textarea rows={3} value={v[f.key]} onChange={(e) => set(f.key, e.target.value)} />
              : f.type === 'select' ? <select value={v[f.key]} onChange={(e) => set(f.key, e.target.value)}>{f.options.map((o) => <option key={o} value={o}>{o}</option>)}</select>
              : f.type === 'multi' ? <select multiple size={Math.min(6, f.options.length)} value={v[f.key].map(String)} onChange={(e) => set(f.key, [...e.target.selectedOptions].map((o) => Number(o.value)))}>
                {f.options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>
              : <input type={f.type === 'number' ? 'number' : 'text'} required={f.required !== false} disabled={f.locked && initial[f.key] != null} value={v[f.key]} onChange={(e) => set(f.key, e.target.value)} />}
          </>}
      </label>)}
      {err && <p className="err">{err}</p>}
      <div className="actions">
        <button type="button" className="btn" onClick={onClose}>Cancel</button>
        <button className="btn primary" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button>
      </div>
    </form>
  </Modal>;
}

export function Spotlight({ icon, title, text, cta, onPress, className = '' }) {
  return <div className={`spotlight ${className}`}>
    <span className="blob b1" /><span className="blob b2" />
    <div className="icon"><LordIcon icon={icon} size={30} colors="primary:#ffffff,secondary:#ffffff" trigger="loop" /></div>
    <h3>{title}</h3>
    <p>{text}</p>
    {cta && <button className="cta" onClick={onPress}>{cta}</button>}
  </div>;
}

export function MiniCalendar() {
  const [m, setM] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const today = new Date();
  const first = m.getDay(), days = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), prev = new Date(m.getFullYear(), m.getMonth(), 0).getDate();
  const cells = [];
  for (let i = first - 1; i >= 0; i--) cells.push({ d: prev - i, mute: true });
  for (let d = 1; d <= days; d++) cells.push({ d, today: d === today.getDate() && m.getMonth() === today.getMonth() && m.getFullYear() === today.getFullYear() });
  while (cells.length % 7) cells.push({ d: cells.length - first - days + 1, mute: true });
  const go = (n) => setM(new Date(m.getFullYear(), m.getMonth() + n, 1));
  return <div className="mini-cal">
    <div className="mc-head">
      <button className="btn ghost" onClick={() => go(-1)} aria-label="Previous month">‹</button>
      <span className="mc-title">{m.toLocaleString('en-IN', { month: 'long', year: 'numeric' })}</span>
      <button className="btn ghost" onClick={() => go(1)} aria-label="Next month">›</button>
    </div>
    <div className="grid7">
      {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((x, i) => <div className="dow" key={i}>{x}</div>)}
      {cells.map((c, i) => <div key={i} className={`day${c.mute ? ' mute' : ''}${c.today ? ' today' : ''}`}>{c.d}</div>)}
    </div>
  </div>;
}
