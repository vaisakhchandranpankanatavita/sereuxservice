/* Demo data for local development: accounts, bookings in every status, reviews, orders, wishlist,
   notifications and coupons. Safe to re-run (fixed ids, upserts). Run `npm run seed` first for the
   catalog.   npm run seed:demo
   Logins (password for all: Demo@12345):
     customer  demo@fixzy.test   customer2@fixzy.test
     provider  pro1@fixzy.test (Anil Kumar, plumbing)   pro2@fixzy.test (Rahul Menon, electrical)  */
import { PrismaClient, BookingStatus } from '@prisma/client';
import { hashPassword } from '../src/common/password';

if (process.env.NODE_ENV === 'production') throw new Error('Refusing to seed demo data in production.');
const prisma = new PrismaClient();
const PASSWORD = 'Demo@12345';

const iso = (offset: number) => { const d = new Date(); d.setDate(d.getDate() + offset); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
const ago = (days: number) => new Date(Date.now() - days * 864e5);

async function user(id: string, email: string, name: string, phone: string, role: 'CUSTOMER' | 'PROVIDER' = 'CUSTOMER') {
  const passwordHash = await hashPassword(PASSWORD);
  return prisma.user.upsert({ where: { email }, create: { id, email, name, phone, passwordHash, role }, update: { name, phone, role } });
}

async function main() {
  if (!(await prisma.service.count()) || !(await prisma.provider.count())) throw new Error('Run `npm run seed` first for the catalog.');

  const demo = await user('demo-customer-1', 'demo@fixzy.test', 'Demo Customer', '9876500001');
  const demo2 = await user('demo-customer-2', 'customer2@fixzy.test', 'Priya Nair', '9876500002');
  const pro1 = await user('demo-pro-1', 'pro1@fixzy.test', 'Anil Kumar', '9876500011', 'PROVIDER');
  const pro2 = await user('demo-pro-2', 'pro2@fixzy.test', 'Rahul Menon', '9876500012', 'PROVIDER');
  await prisma.provider.update({ where: { id: 1 }, data: { userId: pro1.id, online: true, lat: 9.9312, lng: 76.2673 } });
  await prisma.provider.update({ where: { id: 2 }, data: { userId: pro2.id, online: true, lat: 9.9816, lng: 76.2999 } });

  type B = { id: string; userId: string; serviceId: number; providerId: number | null; day: string; slot: string; status: BookingStatus; estimate: number; notes?: string; cancelReason?: string };
  const bookings: B[] = [
    { id: 'DEMO0001', userId: demo.id, serviceId: 1, providerId: 1, day: iso(-12), slot: '09:00', status: 'DONE', estimate: 500, notes: 'Kitchen tap leaking.' },
    { id: 'DEMO0002', userId: demo.id, serviceId: 2, providerId: 2, day: iso(-6), slot: '11:00', status: 'DONE', estimate: 600 },
    { id: 'DEMO0003', userId: demo2.id, serviceId: 1, providerId: 1, day: iso(-3), slot: '13:00', status: 'DONE', estimate: 500 },
    { id: 'DEMO0004', userId: demo.id, serviceId: 1, providerId: 1, day: iso(0), slot: '15:00', status: 'IN_PROGRESS', estimate: 500, notes: 'Bathroom pipe fitting.' },
    { id: 'DEMO0005', userId: demo.id, serviceId: 2, providerId: 2, day: iso(0), slot: '17:00', status: 'ON_THE_WAY', estimate: 600 },
    { id: 'DEMO0006', userId: demo.id, serviceId: 1, providerId: 1, day: iso(2), slot: '09:00', status: 'CONFIRMED', estimate: 500 },
    { id: 'DEMO0007', userId: demo2.id, serviceId: 2, providerId: null, day: iso(3), slot: '11:00', status: 'REQUESTED', estimate: 600, notes: 'Ceiling fan not working.' },
    { id: 'DEMO0008', userId: demo2.id, serviceId: 1, providerId: null, day: iso(4), slot: '13:00', status: 'REQUESTED', estimate: 500 },
    { id: 'DEMO0009', userId: demo.id, serviceId: 3, providerId: 3, day: iso(5), slot: '09:00', status: 'REQUESTED', estimate: 800 },
    { id: 'DEMO0010', userId: demo.id, serviceId: 6, providerId: 5, day: iso(-9), slot: '11:00', status: 'CANCELLED', estimate: 400, cancelReason: 'Plans changed.' },
  ];
  for (const b of bookings) {
    const who = b.userId === demo.id ? demo : demo2;
    const data = {
      ...b, name: who.name, phone: who.phone, address: '12/4 Lake View, Panampilly Nagar, Kochi 682036', lat: 9.9591, lng: 76.2999,
      notes: b.notes ?? '', cancelReason: b.cancelReason ?? null, createdAt: ago(14),
    };
    await prisma.booking.upsert({ where: { id: b.id }, create: data, update: data });
  }

  const reviews = [
    { bookingId: 'DEMO0001', userId: demo.id, target: 1, rating: 5, text: 'Anil fixed the leak in under an hour. Very tidy work.' },
    { bookingId: 'DEMO0002', userId: demo.id, target: 2, rating: 4, text: 'Good job, arrived a little late.' },
    { bookingId: 'DEMO0003', userId: demo2.id, target: 1, rating: 5, text: 'Professional and fairly priced.' },
  ];
  for (const r of reviews) {
    const data = { ...r, kind: 'service', createdAt: ago(2) };
    await prisma.review.upsert({ where: { bookingId: r.bookingId }, create: data, update: data });
  }

  const orders = [
    { id: 'ODDEMO01', userId: demo.id, status: 'DELIVERED' as const, items: [{ productId: 1, qty: 2, unitPrice: 350 }], coupon: null as string | null, discount: 0 },
    { id: 'ODDEMO02', userId: demo.id, status: 'SHIPPED' as const, items: [{ productId: 3, qty: 1, unitPrice: 1649 }, { productId: 1, qty: 1, unitPrice: 350 }], coupon: 'FIXZY10', discount: 200 },
    { id: 'ODDEMO03', userId: demo2.id, status: 'PLACED' as const, items: [{ productId: 5, qty: 2, unitPrice: 600 }], coupon: null, discount: 0 },
  ];
  for (const o of orders) {
    if (await prisma.order.findUnique({ where: { id: o.id } })) continue;
    const who = o.userId === demo.id ? demo : demo2;
    const subtotal = o.items.reduce((n, i) => n + i.qty * i.unitPrice, 0);
    await prisma.order.create({
      data: {
        id: o.id, userId: o.userId, name: who.name, phone: who.phone, address: '12/4 Lake View, Panampilly Nagar', city: 'Kochi', pin: '682036',
        coupon: o.coupon, subtotal, discount: o.discount, total: subtotal - o.discount, status: o.status, paymentMethod: 'COD', createdAt: ago(5),
        items: { create: o.items },
      },
    });
  }

  for (const productId of [2, 3, 6]) {
    await prisma.wishlistItem.upsert({ where: { userId_productId: { userId: demo.id, productId } }, create: { userId: demo.id, productId }, update: {} });
  }

  if (!(await prisma.notification.count({ where: { userId: demo.id } }))) {
    await prisma.notification.createMany({
      data: [
        { userId: demo.id, text: '#DEMO0005: Your pro is on the way.', href: '/orders' },
        { userId: demo.id, text: '#DEMO0004: Work has started.', href: '/orders' },
        { userId: demo.id, text: 'Order #ODDEMO02 has shipped.', href: '/orders', read: true },
      ],
    });
  }
  if (!(await prisma.notification.count({ where: { userId: pro1.id } }))) {
    await prisma.notification.create({ data: { userId: pro1.id, text: `New Plumbing request for ${iso(4)}, 13:00 (#DEMO0008).`, href: '/jobs' } });
  }
  await prisma.coupon.upsert({ where: { code: 'WELCOME20' }, create: { code: 'WELCOME20', percent: 20 }, update: {} });

  console.log(`Demo data ready. Password for every demo login: ${PASSWORD}`);
  console.log('Customers: demo@fixzy.test, customer2@fixzy.test | Pros: pro1@fixzy.test, pro2@fixzy.test | Coupons: FIXZY10, WELCOME20');
}

main().finally(() => prisma.$disconnect());
