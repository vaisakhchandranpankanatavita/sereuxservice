import { useMemo, useState } from 'react';
import { api } from './api.js';
import { Page, act, toast, useList } from './ui.jsx';

const GROUPS = [
  ['content', 'Content'],
  ['rules', 'Business rules'],
  ['flags', 'Feature flags'],
  ['regions', 'Regions'],
];

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

function Control({ def, value, onChange }) {
  if (def.type === 'boolean') {
    return <label className="set-switch"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} /><span>{value ? 'On' : 'Off'}</span></label>;
  }
  if (def.type === 'color') {
    return <span className="set-color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value.toUpperCase())} aria-label={def.label} />
      <input type="text" value={value} maxLength={7} onChange={(e) => onChange(e.target.value)} aria-label={`${def.label} hex`} />
    </span>;
  }
  if (def.type === 'number') {
    return <input type="number" value={value} min={def.min} max={def.max} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} aria-label={def.label} />;
  }
  if (def.type === 'qaList') {
    const list = value ?? [];
    const edit = (i, patch) => onChange(list.map((x, j) => (j === i ? { ...x, ...patch } : x)));
    return <div className="set-qa">
      {list.map((x, i) => <div className="set-qa-row" key={i}>
        <input type="text" value={x.q} placeholder="Question" onChange={(e) => edit(i, { q: e.target.value })} aria-label={`Question ${i + 1}`} />
        <textarea rows={2} value={x.a} placeholder="Answer" onChange={(e) => edit(i, { a: e.target.value })} aria-label={`Answer ${i + 1}`} />
        <button type="button" className="btn sm ghost" onClick={() => onChange(list.filter((_, j) => j !== i))} aria-label={`Remove question ${i + 1}`}>Remove</button>
      </div>)}
      <button type="button" className="btn sm" onClick={() => onChange([...list, { q: '', a: '' }])}>Add question</button>
    </div>;
  }
  if (def.type === 'stringList' || def.type === 'timeList') {
    return <textarea rows={3} value={value.join('\n')} placeholder="One per line" onChange={(e) => onChange(e.target.value.split('\n'))} aria-label={def.label} />;
  }
  return <input type={def.type === 'url' ? 'url' : 'text'} value={value} onChange={(e) => onChange(e.target.value)} aria-label={def.label} />;
}

export function Settings() {
  const { rows, error, reload } = useList('/admin/settings');
  const [tab, setTab] = useState('content');
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(false);

  const list = useMemo(() => (rows ?? []).filter((d) => d.group === tab), [rows, tab]);
  const current = (d) => (d.key in draft ? draft[d.key] : d.value);
  const dirty = (rows ?? []).filter((d) => d.key in draft && !same(draft[d.key], d.value));
  const dirtyIn = (g) => dirty.filter((d) => d.group === g).length;

  const clean = (d, v) => (d.type === 'stringList' || d.type === 'timeList' ? v.map((s) => s.trim()).filter(Boolean)
    : d.type === 'qaList' ? v.filter((x) => x.q.trim() || x.a.trim()) : v);

  const save = async () => {
    setBusy(true);
    let ok = 0;
    for (const d of dirty) {
      try {
        await api(`/admin/settings/${d.key}`, { method: 'PUT', body: { value: clean(d, draft[d.key]) } });
        ok++;
        setDraft((p) => { const { [d.key]: _, ...rest } = p; return rest; });
      } catch (e) { toast(`${d.label}: ${e.message}`); break; }
    }
    if (ok) { toast(`${ok} setting${ok === 1 ? '' : 's'} saved`); await reload(); }
    setBusy(false);
  };

  const reset = async (d) => {
    if (!confirm(`Reset "${d.label}" to its default?`)) return;
    await act(() => api(`/admin/settings/${d.key}`, { method: 'DELETE' }), 'Reset to default', reload);
    setDraft((p) => { const { [d.key]: _, ...rest } = p; return rest; });
  };

  return <Page title="Settings" actions={<>
    {!!dirty.length && <button type="button" className="btn" onClick={() => setDraft({})} disabled={busy}>Discard</button>}
    <button type="button" className="btn primary" onClick={save} disabled={!dirty.length || busy}>{busy ? 'Saving…' : dirty.length ? `Save ${dirty.length} change${dirty.length === 1 ? '' : 's'}` : 'Saved'}</button>
  </>}>
    <div className="tchips set-tabs" role="tablist" aria-label="Settings groups">
      {GROUPS.map(([id, name]) => <button type="button" role="tab" aria-selected={tab === id} key={id} className={`tchip${tab === id ? ' on' : ''}`} onClick={() => setTab(id)}>
        {name}{dirtyIn(id) > 0 && <span className="set-dot" aria-label="unsaved changes" />}
      </button>)}
    </div>
    {error && <div className="empty">{error}</div>}
    {!rows && !error && <div className="empty">Loading…</div>}
    {rows && <section className="card set-card">
      {list.map((d) => <div className="set-row" key={d.key}>
        <div className="set-meta">
          <b>{d.label}</b>
          <small>{d.key}{!d.public && ' · server only'}{d.overridden ? '' : ' · default'}</small>
        </div>
        <div className="set-ctl"><Control def={d} value={current(d)} onChange={(v) => setDraft((p) => ({ ...p, [d.key]: v }))} /></div>
        <button type="button" className="btn sm ghost" disabled={!d.overridden} onClick={() => reset(d)} title="Reset to default">Reset</button>
      </div>)}
    </section>}
    <p className="set-note">Changes reach the apps the next time they open (or refresh their config). Each change is recorded in the audit log.</p>
  </Page>;
}
