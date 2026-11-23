import { useEffect, useState } from 'react';
import { Switch, View } from 'react-native';
import { api } from './api';
import { Row, Txt, useTheme } from './ui';

/* Lets the user turn push alerts off or on. Alerts still appear in the in-app notifications list either way. */
export default function PushToggle() {
  const t = useTheme();
  const [on, setOn] = useState<boolean | null>(null);
  useEffect(() => { api('/notification-settings').then((s: any) => setOn(!!s.push)).catch(() => {}); }, []);
  if (on === null) return null;
  const change = async (v: boolean) => {
    setOn(v);
    try { await api('/notification-settings', 'PUT', { push: v }); } catch { setOn(!v); }
  };
  return <Row between>
    <View style={{ flex: 1 }}><Txt bold size={15}>Push notifications</Txt><Txt muted size={13}>Booking updates and offers on this phone</Txt></View>
    <Switch value={on} onValueChange={change} trackColor={{ true: t.ok }} />
  </Row>;
}
