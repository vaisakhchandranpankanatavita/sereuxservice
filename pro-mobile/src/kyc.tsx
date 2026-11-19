import { useState } from 'react';
import { View } from 'react-native';
import { api } from './api';
import { takePhoto } from './photo';
import { Button, Card, Chip, Chips, Field, Txt, useFetch, useTheme } from './ui';

const DOCS: [string, string][] = [['AADHAAR', 'Aadhaar'], ['PAN', 'PAN'], ['DRIVING_LICENCE', 'Driving licence'], ['VOTER_ID', 'Voter ID']];

/* Identity verification. Pros can't go online or accept jobs until an admin approves their document. */
export function KycCard({ onChange }: { onChange?: () => void }) {
  const t = useTheme();
  const k = useFetch<any>('/pro/kyc');
  const [docType, setDocType] = useState('AADHAAR');
  const [docNumber, setDocNumber] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [editing, setEditing] = useState(false);

  if (!k.data || k.data.status === 'APPROVED') return null;
  const s = k.data.status as string;
  const form = s === 'NOT_SUBMITTED' || (s === 'REJECTED') || editing;

  const submit = async () => {
    setErr('');
    if (docNumber.trim().length < 4) return setErr('Enter the document number.');
    if (!image) return setErr('Add a clear photo of the document.');
    setBusy(true);
    try { await api('/pro/kyc', 'POST', { docType, docNumber: docNumber.trim(), docImage: image }); setEditing(false); setImage(null); setDocNumber(''); await k.reload(); onChange?.(); }
    catch (e: any) { setErr(e.message); }
    finally { setBusy(false); }
  };

  return <Card style={{ padding: 18, gap: 12, backgroundColor: s === 'PENDING' ? t.infoBg : t.warnBg }}>
    <Txt bold size={18}>{s === 'PENDING' ? 'Verification in review' : s === 'REJECTED' ? 'Verification needs attention' : 'Verify your identity'}</Txt>
    {s === 'PENDING' && !form && <>
      <Txt muted size={14}>We received your {DOCS.find((d) => d[0] === k.data.docType)?.[1] ?? 'document'} ({k.data.docNumber}). You can go online as soon as it’s approved.</Txt>
      <Button title="Resubmit" kind="ghost" onPress={() => setEditing(true)} />
    </>}
    {s === 'REJECTED' && !!k.data.note && <Txt color={t.bad} size={14}>{k.data.note}</Txt>}
    {form && <>
      {s === 'NOT_SUBMITTED' && <Txt muted size={14}>Customers trust verified pros. Submit a government ID to start taking jobs.</Txt>}
      <Chips>{DOCS.map(([v, l]) => <Chip key={v} title={l} on={docType === v} onPress={() => setDocType(v)} />)}</Chips>
      <Field label="Document number" value={docNumber} onChangeText={setDocNumber} autoCapitalize="characters" />
      <Button title={image ? 'Retake document photo' : 'Add document photo'} kind="ghost" onPress={async () => { const p = await takePhoto(); if (p) setImage(p); }} />
      {image && <Txt size={13} color={t.ok}>Photo attached ✓</Txt>}
      {!!err && <Txt color={t.bad}>{err}</Txt>}
      <Button title="Submit for review" busy={busy} onPress={submit} />
    </>}
  </Card>;
}
