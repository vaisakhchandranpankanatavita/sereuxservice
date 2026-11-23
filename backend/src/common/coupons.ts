import { BadRequestException } from '@nestjs/common';
import type { Coupon } from '@prisma/client';

/** Anything with the prisma delegates we need (PrismaService or a transaction client). */
type Db = {
  coupon: { findUnique: (a: any) => Promise<Coupon | null> };
  booking: { count: (a: any) => Promise<number> };
  order: { count: (a: any) => Promise<number> };
};

const INVALID = 'That code isn’t valid.';

/** Redemptions are derived from non-cancelled bookings and orders carrying the code. */
export async function couponUses(db: Db, code: string, userId?: string) {
  const who = userId ? { userId } : {};
  const [b, o] = await Promise.all([
    db.booking.count({ where: { coupon: code, status: { not: 'CANCELLED' }, ...who } }),
    db.order.count({ where: { coupon: code, status: { not: 'CANCELLED' }, ...who } }),
  ]);
  return b + o;
}

/**
 * Checks every rule on a code for this customer and basket, and returns the coupon with the discount in rupees.
 * `amount` is the subtotal (orders) or the quoted price (bookings); pass undefined for a bare preview.
 */
export async function applyCoupon(db: Db, rawCode: string, userId: string, amount?: number) {
  const c = await db.coupon.findUnique({ where: { code: rawCode.trim().toUpperCase() } });
  if (!c?.active) throw new BadRequestException(INVALID);
  if (c.expiresAt && c.expiresAt.getTime() < Date.now()) throw new BadRequestException('That code has expired.');
  if (amount !== undefined && c.minOrder && amount < c.minOrder) throw new BadRequestException(`This code needs a minimum of ₹${c.minOrder}.`);
  if (c.usageLimit != null && (await couponUses(db, c.code)) >= c.usageLimit) throw new BadRequestException('That code has been fully redeemed.');
  if (c.perUserLimit != null && (await couponUses(db, c.code, userId)) >= c.perUserLimit) throw new BadRequestException('You have already used that code.');
  let discount = 0;
  if (amount !== undefined) {
    discount = Math.round(amount * (c.percent / 100));
    if (c.maxDiscount) discount = Math.min(discount, c.maxDiscount);
  }
  return { coupon: c, discount };
}
