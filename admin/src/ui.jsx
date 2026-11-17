import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { api } from './api.js';
import { LordIcon } from './LordIcon.jsx';

export const money = (n) => '₹' + Number(n || 0).toLocaleString('en-IN');
export const when = (d) => new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/* Status chip: a solid, glossy pill in the status's own colour, with a white icon medallion —
   one hue + one glyph per state so a column can be scanned by colour and shape, not just by reading. */
const G = (d) => <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d}</svg>;
const ICON = {
  check: G(<path d="M3.5 8.5l3 3 6-7" />), x: G(<path d="M4 4l8 8M12 4l-8 8" />), clock: G(<><circle cx="8" cy="8" r="5.5" /><path d="M8 5v3.2l2 1.3" /></>),
  arrow: G(<path d="M3 8h9M8.5 4l4 4-4 4" />), spin: G(<path className="spin" d="M8 2.5a5.5 5.5 0 105.5 5.5" />), shield: G(<path d="M8 2l5 2v4c0 3-2.2 5-5 6-2.8-1-5-3-5-6V4z" />),
  star: G(<path d="M8 2.2l1.8 3.7 4 .5-3 2.8.8 4L8 11.2 4.4 13.2l.8-4-3-2.8 4-.5z" />), bolt: G(<path d="M9 2L4 9h4l-1 5 5-7H8z" />), user: G(<><circle cx="8" cy="5.5" r="2.5" /><path d="M3 13.5c.6-2.6 2.5-4 5-4s4.4 1.4 5 4" /></>),
};
const CHIP = {
  DONE: ['#16a34a', 'check'], DELIVERED: ['#16a34a', 'check'], CONFIRMED: ['#4f46e5', 'shield'], SHIPPED: ['#0284c7', 'arrow'], ON_THE_WAY: ['#0284c7', 'arrow'],
  IN_PROGRESS: ['#ea580c', 'spin'], REQUESTED: ['#b7791f', 'clock'], PLACED: ['#b7791f', 'clock'], CANCELLED: ['#dc2626', 'x'],
  ADMIN: ['#7c3aed', 'star'], PROVIDER: ['#0d9488', 'bolt'], CUSTOMER: ['#64748b', 'user'],
};
export const Badge = ({ v, text }) => {
  const [c, ic] = CHIP[v] ?? ['#64748b', 'clock'];
  return <span className="chip" style={{ '--bc': c }}><i className="chip-ic">{ICON[ic]}</i>{text ?? String(v).replace(/_/g, ' ').toLowerCase()}</span>;
};

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
    {(title || actions) && <div className="head">{title && <h1 className="page-title">{title}</h1>}<div className="grow" />{actions}</div>}
    {children}
  </>;
}

/* Plain text of a rendered cell (for searching) — skips controls like <select>/<button>. */
const SKIP = new Set(['select', 'option', 'button', 'img', 'svg']);
function textOf(n) {
  if (n == null || n === false || n === true) return '';
  if (typeof n === 'string' || typeof n === 'number') return String(n);
  if (Array.isArray(n)) return n.map(textOf).join(' ');
  if (n.type === Badge) return n.props.text ?? String(n.props.v).replace(/_/g, ' ').toLowerCase();
  if (typeof n.type === 'string' && SKIP.has(n.type)) return '';
  return textOf(n.props?.children);
}
const nice = (x) => String(x).replace(/_/g, ' ').toLowerCase();

/* Every table gets a filter bar: instant search across all columns, plus one-click chips (or a
   dropdown when there are many options) for any column declared with `filter: true`.
   Columns may give `v: (row) => string` as their search/filter value; otherwise it is read from
   what the cell renders. */
export function Table({ cols, rows, error, empty = 'Nothing here yet.' }) {
  const wrapRef = useRef(null);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState({}); // { colIndex: value }
  /* Click-and-drag on blank table area pans sideways (scrollbars are slim, mouse wheels can't go sideways). */
  const panStart = (e) => {
    const el = wrapRef.current;
    if (!el || e.button !== 0 || el.scrollWidth <= el.clientWidth || e.target.closest('button, select, input, a, textarea')) return;
    const x0 = e.clientX, s0 = el.scrollLeft;
    let moved = false;
    const move = (ev) => { if (Math.abs(ev.clientX - x0) > 4) moved = true; if (moved) { el.scrollLeft = s0 - (ev.clientX - x0); el.classList.add('panning'); } };
    const up = () => { removeEventListener('pointermove', move); removeEventListener('pointerup', up); el.classList.remove('panning'); };
    addEventListener('pointermove', move); addEventListener('pointerup', up);
  };

  const val = (c, r) => String(c.v ? c.v(r) : textOf(c.render(r)));
  const index = useMemo(() => (rows ?? []).map((r) => ({ r, hay: cols.map((c) => val(c, r)).join(' | ').toLowerCase(), f: cols.map((c) => (c.filter ? val(c, r) : null)) })), [rows, cols]);
  const filterCols = cols.map((c, i) => (c.filter ? { i, h: c.h, opts: [...new Set(index.map((x) => x.f[i]).filter((x) => x !== '' && x != null))].sort() } : null)).filter(Boolean);

  if (error) return <div className="card err">{error}</div>;
  if (!rows) return <div className="empty">Loading…</div>;

  /* One row only: the first small filter becomes one-click chips, any others are compact dropdowns. */
  const chipCol = filterCols.find((fc) => fc.h === 'Status' && fc.opts.length > 1 && fc.opts.length <= 6) ?? filterCols.find((fc) => fc.opts.length > 1 && fc.opts.length <= 5);
  const needle = q.trim().toLowerCase();
  const shown = index.filter((x) => (!needle || x.hay.includes(needle)) && filterCols.every((fc) => !sel[fc.i] || x.f[fc.i] === sel[fc.i])).map((x) => x.r);
  const active = !!needle || Object.values(sel).some(Boolean);
  const clear = () => { setQ(''); setSel({}); };
  const pick = (i, v) => setSel((p) => ({ ...p, [i]: p[i] === v ? '' : v }));

  return <>
    {(rows.length > 0 || active) && <div className="tbar">
      <label className="tsearch">
        <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><circle cx="9" cy="9" r="5.5" /><path d="M13.5 13.5L17 17" /></svg>
        <input type="search" placeholder="Search this table…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search this table" />
      </label>
      {filterCols.map((fc) => fc.opts.length <= 1 ? null : fc === chipCol
        ? <div className="tchips" key={fc.i} role="group" aria-label={`Filter by ${fc.h}`}>
          <span className="tchips-l">{fc.h}</span>
          <button type="button" className={`tchip${!sel[fc.i] ? ' on' : ''}`} onClick={() => setSel((p) => ({ ...p, [fc.i]: '' }))}>All</button>
          {fc.opts.map((o) => <button type="button" key={o} className={`tchip${sel[fc.i] === o ? ' on' : ''}`} aria-pressed={sel[fc.i] === o} onClick={() => pick(fc.i, o)}>{nice(o)}</button>)}
        </div>
        : <label className="tsel" key={fc.i}><span>{fc.h}</span>
          <select value={sel[fc.i] ?? ''} onChange={(e) => setSel((p) => ({ ...p, [fc.i]: e.target.value }))} aria-label={`Filter by ${fc.h}`}>
            <option value="">All</option>{fc.opts.map((o) => <option key={o} value={o}>{nice(o)}</option>)}
          </select></label>)}
      <span className="tcount" aria-live="polite">{active ? `${shown.length} of ${rows.length}` : `${rows.length} ${rows.length === 1 ? 'row' : 'rows'}`}</span>
      {active && <button type="button" className="tclear" onClick={clear}>Clear filters</button>}
    </div>}
    <div className="tablewrap" ref={wrapRef} onPointerDown={panStart}>
      <table>
        <thead><tr>{cols.map((c, j) => <th key={j} className={c.num ? 'num' : undefined}>{c.h}</th>)}</tr></thead>
        <tbody>{shown.map((r, i) => <tr key={r.id ?? r.code ?? i}>{cols.map((c, j) => <td key={j} className={[c.wrap && 'wrap', c.num && 'num'].filter(Boolean).join(' ') || undefined}>{c.render(r)}</td>)}</tr>)}</tbody>
      </table>
      {!rows.length && <div className="empty">{empty}</div>}
      {!!rows.length && !shown.length && <div className="empty">No results match your filters. <button type="button" className="tclear" onClick={clear}>Clear filters</button></div>}
    </div>
  </>;
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
