import { useCallback, useState } from 'react';
import { Modal, Platform } from 'react-native';
import { api } from './api';

type PayUser = { name: string; email: string; phone: string };
type Cfg = { keyId: string; orderId: string; amount: number; currency: string; description: string; name: string; email: string; contact: string };

/* Builds the hosted Checkout page run inside the native WebView. Talks back to RN via postMessage;
   on web the same script is loaded straight into the page instead (see usePayment below). */
function checkoutHtml(cfg: Cfg) {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"/></head>
<body style="margin:0;background:#f9f5f2">
<script src="https://checkout.razorpay.com/v1/checkout.js"></script>
<script>
function send(msg){ window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(msg)); }
var rp = new Razorpay({
  key: ${JSON.stringify(cfg.keyId)}, amount: ${cfg.amount}, currency: ${JSON.stringify(cfg.currency)}, order_id: ${JSON.stringify(cfg.orderId)},
  name: 'Fixzy', description: ${JSON.stringify(cfg.description)},
  prefill: { name: ${JSON.stringify(cfg.name)}, email: ${JSON.stringify(cfg.email)}, contact: ${JSON.stringify(cfg.contact)} },
  theme: { color: '#141412' },
  handler: function (resp) { send({ type: 'success', resp: resp }); },
  modal: { ondismiss: function () { send({ type: 'dismiss' }); } },
});
rp.on('payment.failed', function (resp) { send({ type: 'failed', error: resp.error && resp.error.description }); });
rp.open();
</script>
</body></html>`;
}

async function loadRazorpayWeb() {
  if ((window as any).Razorpay) return;
  await new Promise<void>((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://checkout.razorpay.com/v1/checkout.js';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Could not load the payment form. Check your connection.'));
    document.body.appendChild(s);
  });
}

type Session = { orderId: string; cfg: Cfg; resolve: () => void; reject: (e: Error) => void };

/* payNow(orderId, user) starts (or resumes) online payment for an order already placed with
   paymentMethod ONLINE. Render `node` somewhere in the screen's tree — it's the full-screen
   Checkout WebView on native, and nothing on web (where Checkout opens as its own overlay). */
export function usePayment() {
  const [session, setSession] = useState<Session | null>(null);

  const payNow = useCallback((orderId: string, user: PayUser) => {
    return new Promise<void>((resolve, reject) => {
      (async () => {
        try {
          const { keyId, razorpayOrderId, amount, currency } = await api(`/payments/orders/${orderId}`, 'POST');
          const cfg: Cfg = { keyId, orderId: razorpayOrderId, amount, currency, description: `Order #${orderId}`, name: user.name, email: user.email, contact: user.phone };
          if (Platform.OS === 'web') {
            await loadRazorpayWeb();
            const rp = new (window as any).Razorpay({
              key: cfg.keyId, amount: cfg.amount, currency: cfg.currency, order_id: cfg.orderId, name: 'Fixzy', description: cfg.description,
              prefill: { name: cfg.name, email: cfg.email, contact: cfg.contact }, theme: { color: '#141412' },
              handler: (resp: any) => api(`/payments/orders/${orderId}/verify`, 'POST', resp).then(resolve, reject),
              modal: { ondismiss: () => reject(new Error('Payment cancelled. You can try again.')) },
            });
            rp.on('payment.failed', () => reject(new Error('Payment failed. You can try again.')));
            rp.open();
          } else {
            setSession({ orderId, cfg, resolve, reject });
          }
        } catch (e: any) { reject(e); }
      })();
    });
  }, []);

  const onMessage = useCallback((e: any) => {
    if (!session) return;
    const msg = JSON.parse(e.nativeEvent.data);
    const { orderId, resolve, reject } = session;
    setSession(null);
    if (msg.type === 'success') api(`/payments/orders/${orderId}/verify`, 'POST', msg.resp).then(resolve, reject);
    else if (msg.type === 'dismiss') reject(new Error('Payment cancelled. You can try again.'));
    else reject(new Error(msg.error || 'Payment failed. You can try again.'));
  }, [session]);

  const node = session ? <NativeCheckout cfg={session.cfg} onMessage={onMessage}
    onClose={() => { session.reject(new Error('Payment cancelled. You can try again.')); setSession(null); }} /> : null;

  return { payNow, node };
}

function NativeCheckout({ cfg, onMessage, onClose }: { cfg: Cfg; onMessage: (e: any) => void; onClose: () => void }) {
  const { WebView } = require('react-native-webview');
  return <Modal visible animationType="slide" onRequestClose={onClose}>
    <WebView source={{ html: checkoutHtml(cfg) }} onMessage={onMessage} style={{ flex: 1 }} />
  </Modal>;
}
