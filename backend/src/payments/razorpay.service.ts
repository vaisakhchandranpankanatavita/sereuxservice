import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'crypto';

/* Thin wrapper over Razorpay's plain REST API (https://razorpay.com/docs/api/) — no SDK dependency.
   Online payment is entirely optional: every method throws a clear 503 until RAZORPAY_KEY_ID/SECRET
   are set, so pay-on-delivery keeps working in any environment without keys. */
@Injectable()
export class RazorpayService {
  private readonly log = new Logger('Razorpay');

  private get keyId() { return process.env.RAZORPAY_KEY_ID; }
  private get keySecret() { return process.env.RAZORPAY_KEY_SECRET; }
  get configured() { return !!(this.keyId && this.keySecret); }

  private assertConfigured() {
    if (!this.configured) throw new ServiceUnavailableException('Online payment isn’t set up yet. Choose pay on delivery.');
  }

  private auth() {
    return 'Basic ' + Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
  }

  /* amount is in the smallest currency unit (paise for INR). */
  async createOrder(amount: number, receipt: string) {
    this.assertConfigured();
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: this.auth() },
      body: JSON.stringify({ amount, currency: 'INR', receipt }),
    });
    const body = await res.json().catch(() => null);
    if (!res.ok) {
      this.log.error(`createOrder failed: ${res.status} ${JSON.stringify(body)}`);
      throw new ServiceUnavailableException('Could not start the payment. Try again.');
    }
    return body as { id: string; amount: number; currency: string };
  }

  /* HMAC-SHA256 of "order_id|payment_id" signed with the key secret — what the Checkout SDK hands back. */
  verifyCheckoutSignature(orderId: string, paymentId: string, signature: string) {
    if (!this.configured) return false;
    const expected = createHmac('sha256', this.keySecret!).update(`${orderId}|${paymentId}`).digest('hex');
    return safeEqual(expected, signature);
  }

  /* HMAC-SHA256 of the raw request body signed with the separate webhook secret (set in the Razorpay dashboard). */
  verifyWebhookSignature(rawBody: Buffer, signature: string | undefined) {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret || !signature) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return safeEqual(expected, signature);
  }

  /* Best-effort: failures are logged, never thrown, so an admin cancellation always succeeds. */
  async refund(paymentId: string, amount: number) {
    if (!this.configured) { this.log.warn(`Skipped refund for ${paymentId}: Razorpay isn’t configured.`); return null; }
    try {
      const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: this.auth() },
        body: JSON.stringify({ amount }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok) { this.log.error(`refund failed for ${paymentId}: ${res.status} ${JSON.stringify(body)}`); return null; }
      return body as { id: string };
    } catch (e) {
      this.log.error(`refund threw for ${paymentId}: ${e}`);
      return null;
    }
  }
}

function safeEqual(a: string, b: string) {
  const bufA = Buffer.from(a), bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
