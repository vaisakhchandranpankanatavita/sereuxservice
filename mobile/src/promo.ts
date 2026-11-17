/* A coupon the customer tapped "Apply" on from a home-screen banner. The next coupon box
   (booking or checkout) picks it up and validates it with the server. */
let pending: string | null = null;
export const setPendingCoupon = (code: string | null) => { pending = code; };
export const takePendingCoupon = () => { const c = pending; pending = null; return c; };
export const peekPendingCoupon = () => pending;
