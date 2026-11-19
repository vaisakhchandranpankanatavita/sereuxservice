import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BookingStatus, OrderStatus, Prisma, Role } from '@prisma/client';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/auth';
import { PushService } from '../common/push';
import { PaymentsModule, PaymentsService } from '../payments/payments.module';

const BOOKING_STATUSES = Object.values(BookingStatus);
const ORDER_STATUSES = Object.values(OrderStatus);
const ROLES = Object.values(Role);

class ServiceDto {
  @IsString() @MaxLength(80) name: string;
  @IsString() @MaxLength(300) description: string;
  @IsString() @MaxLength(60) category: string;
  @IsInt() @Min(0) fromPrice: number;
  @IsInt() @Min(5) duration: number;
  @IsOptional() @IsString() @MaxLength(300) terms?: string;
}
class PatchServiceDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsString() @MaxLength(300) description?: string;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsInt() @Min(0) fromPrice?: number;
  @IsOptional() @IsInt() @Min(5) duration?: number;
  @IsOptional() @IsString() @MaxLength(300) terms?: string;
}

class ProviderDto {
  @IsString() @MaxLength(80) name: string;
  @IsInt() @Min(0) @Max(60) years: number;
  @IsString() @MaxLength(60) response: string;
  @IsBoolean() verified: boolean;
  @IsArray() @IsInt({ each: true }) serviceIds: number[];
  @IsOptional() @IsInt() @Min(0) @Max(100) commissionPercent?: number;
}
class PatchProviderDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) years?: number;
  @IsOptional() @IsString() @MaxLength(60) response?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsArray() @IsInt({ each: true }) serviceIds?: number[];
  @IsOptional() @IsInt() @Min(0) @Max(100) commissionPercent?: number;
}

class RecordPayoutDto {
  @IsInt() providerId: number;
  @IsInt() @Min(1) amount: number;
  @IsOptional() @IsString() @MaxLength(200) note?: string;
}

class ProductDto {
  @IsString() @MaxLength(120) name: string;
  @IsString() @MaxLength(80) seller: string;
  @IsInt() @Min(0) price: number;
  @IsInt() @Min(0) oldPrice: number;
  @IsString() @MaxLength(60) category: string;
  @IsString() @MaxLength(300) img: string;
  @IsOptional() @IsString() @MaxLength(500) blurb?: string;
}
class PatchProductDto {
  @IsOptional() @IsString() @MaxLength(120) name?: string;
  @IsOptional() @IsString() @MaxLength(80) seller?: string;
  @IsOptional() @IsInt() @Min(0) price?: number;
  @IsOptional() @IsInt() @Min(0) oldPrice?: number;
  @IsOptional() @IsString() @MaxLength(60) category?: string;
  @IsOptional() @IsString() @MaxLength(300) img?: string;
  @IsOptional() @IsString() @MaxLength(500) blurb?: string;
}

class CouponDto {
  @Matches(/^[A-Z0-9_-]{3,32}$/) code: string;
  @IsInt() @Min(1) @Max(100) percent: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class PatchCouponDto {
  @IsOptional() @IsInt() @Min(1) @Max(100) percent?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

class BannerDto {
  @IsString() @MaxLength(80) title: string;
  @IsOptional() @IsString() @MaxLength(160) subtitle?: string;
  @IsOptional() @IsString() @MaxLength(300) img?: string;
  @IsOptional() @Matches(/^#[0-9A-Fa-f]{6}$/) color?: string;
  @IsOptional() @IsString() @MaxLength(32) coupon?: string;
  @IsOptional() @IsInt() serviceId?: number | null;
  @IsOptional() @IsInt() sort?: number;
  @IsOptional() @IsBoolean() active?: boolean;
}
class PatchBannerDto extends BannerDto {
  @IsOptional() @IsString() @MaxLength(80) declare title: string;
}

class BookingAssignDto {
  @IsOptional() @IsInt() providerId: number | null;
}
class BroadcastDto {
  @IsIn(['ALL', 'CUSTOMER', 'PROVIDER']) audience: 'ALL' | 'CUSTOMER' | 'PROVIDER';
  @IsString() @MaxLength(60) title: string;
  @IsString() @MaxLength(240) text: string;
  @IsOptional() @IsString() @MaxLength(200) href?: string;
}
class PromoteAdminDto {
  @IsString() @MaxLength(254) email: string;
}
class LinkProviderDto {
  @IsOptional() @IsString() @MaxLength(254) email?: string | null;
}
class BookingStatusDto { @IsIn(BOOKING_STATUSES) status: BookingStatus; }
class OrderStatusDto { @IsIn(ORDER_STATUSES) status: OrderStatus; }
class RoleDto { @IsIn(ROLES) role: Role; }

const page = (skip?: string, take = 50) => ({ skip: Math.max(0, Number(skip) || 0), take });

@Injectable()
class AdminService {
  constructor(private prisma: PrismaService, private payments: PaymentsService, private push: PushService) {}

  private audit(me: AuthUser, action: string, target: string, meta?: unknown) {
    return this.prisma.auditLog.create({ data: { actorId: me.id, actorEmail: me.email, action, target, meta: meta as Prisma.InputJsonValue } });
  }

  listAuditLog(q: { skip?: string; action?: string; q?: string }) {
    const where: Prisma.AuditLogWhereInput = {};
    if (q.action) where.action = q.action;
    if (q.q) where.OR = [{ actorEmail: { contains: q.q, mode: 'insensitive' } }, { target: { contains: q.q, mode: 'insensitive' } }];
    return this.prisma.auditLog.findMany({ where, orderBy: { createdAt: 'desc' }, ...page(q.skip, 100) });
  }

  async stats() {
    const today = new Date().toISOString().slice(0, 10);
    const since = new Date(Date.now() - 30 * 864e5);
    const [users, bookings, orders, openBookings, todayBookings, byStatus, revenue, recentBookings, recentOrders, messages] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.booking.count(),
      this.prisma.order.count(),
      this.prisma.booking.count({ where: { status: { in: ['REQUESTED', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'] } } }),
      this.prisma.booking.count({ where: { day: today, status: { not: 'CANCELLED' } } }),
      this.prisma.booking.groupBy({ by: ['status'], _count: true }),
      this.prisma.order.aggregate({ _sum: { total: true }, where: { status: { not: 'CANCELLED' } } }),
      this.prisma.booking.findMany({ where: { createdAt: { gte: since } }, select: { createdAt: true } }),
      this.prisma.order.findMany({ where: { createdAt: { gte: since }, status: { not: 'CANCELLED' } }, select: { createdAt: true, total: true } }),
      this.prisma.contactMessage.count(),
    ]);
    const days: Record<string, { day: string; bookings: number; orders: number; revenue: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      days[d] = { day: d, bookings: 0, orders: 0, revenue: 0 };
    }
    for (const b of recentBookings) { const d = days[b.createdAt.toISOString().slice(0, 10)]; if (d) d.bookings++; }
    for (const o of recentOrders) {
      const d = days[o.createdAt.toISOString().slice(0, 10)];
      if (d) { d.orders++; d.revenue += o.total; }
    }
    return {
      users, bookings, orders, openBookings, todayBookings, messages,
      productRevenue: revenue._sum.total ?? 0,
      bookingsByStatus: Object.fromEntries(byStatus.map((s) => [s.status, s._count])),
      series: Object.values(days),
    };
  }

  /* Bookings */
  listBookings(q: { status?: string; q?: string; skip?: string }) {
    const where: Prisma.BookingWhereInput = {};
    if (q.status && BOOKING_STATUSES.includes(q.status as BookingStatus)) where.status = q.status as BookingStatus;
    if (q.q) where.OR = [{ id: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }];
    return this.prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' }, ...page(q.skip), include: { service: true, provider: true, payment: true } });
  }

  async assign(me: AuthUser, id: string, providerId: number | null) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    if (providerId !== null && providerId !== undefined) {
      const p = await this.prisma.provider.findFirst({ where: { id: providerId, services: { some: { id: b.serviceId } } } });
      if (!p) throw new BadRequestException('That pro does not offer this service.');
      const clash = await this.prisma.booking.findFirst({ where: { providerId, day: b.day, slot: b.slot, status: { not: 'CANCELLED' }, id: { not: id } } });
      if (clash) throw new ConflictException('That pro already has a job in this slot.');
    }
    const out = await this.prisma.booking.update({ where: { id }, data: { providerId: providerId ?? null }, include: { service: true, provider: true } });
    await this.audit(me, 'booking.assign', `booking:${id}`, { providerId });
    return out;
  }

  /* Orders */
  listOrders(q: { status?: string; q?: string; skip?: string }) {
    const where: Prisma.OrderWhereInput = {};
    if (q.status && ORDER_STATUSES.includes(q.status as OrderStatus)) where.status = q.status as OrderStatus;
    if (q.q) where.OR = [{ id: { contains: q.q, mode: 'insensitive' } }, { name: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }];
    return this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, ...page(q.skip), include: { items: { include: { product: { select: { name: true } } } }, payment: true } });
  }

  async setOrderStatus(me: AuthUser, id: string, status: OrderStatus) {
    const o = await this.prisma.order.findUnique({ where: { id } });
    if (!o) throw new NotFoundException();
    if (o.status === 'DELIVERED' || o.status === 'CANCELLED') throw new BadRequestException('Order is already closed.');
    const text = { PLACED: 'is placed', SHIPPED: 'has shipped', DELIVERED: 'was delivered', CANCELLED: 'was cancelled' }[status];
    const out = await this.prisma.$transaction(async (tx) => {
      const out = await tx.order.update({ where: { id }, data: { status } });
      await tx.notification.create({ data: { userId: o.userId, text: `Order #${id} ${text}.`, href: '/orders' } });
      return out;
    });
    await this.push.send(o.userId, `Order #${id} ${text}.`, 'Fixzy', { href: '/orders' });
    await this.audit(me, 'order.status', `order:${id}`, { from: o.status, to: status });
    if (status === 'CANCELLED') await this.payments.refundIfPaid(id); // best-effort; never blocks the status change
    return out;
  }

  /* Users */
  listUsers(q: { q?: string; role?: string; skip?: string }) {
    const where: Prisma.UserWhereInput = {};
    if (q.role && ROLES.includes(q.role as Role)) where.role = q.role as Role;
    if (q.q) where.OR = [{ name: { contains: q.q, mode: 'insensitive' } }, { email: { contains: q.q, mode: 'insensitive' } }, { phone: { contains: q.q } }];
    return this.prisma.user.findMany({
      where, orderBy: { createdAt: 'desc' }, ...page(q.skip),
      select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true, _count: { select: { bookings: true, orders: true } } },
    });
  }

  async setRole(me: AuthUser, id: string, role: Role) {
    if (me.id === id) throw new BadRequestException('You cannot change your own role.');
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new NotFoundException();
    const out = await this.prisma.user.update({ where: { id }, data: { role }, select: { id: true, name: true, email: true, phone: true, role: true, createdAt: true } });
    await this.audit(me, 'user.role', `user:${id}`, { email: u.email, from: u.role, to: role });
    return out;
  }

  /* Catalog: ids are manually assigned integers, so next id = max + 1 */
  private async nextId(model: 'service' | 'provider' | 'product') {
    const r = await (this.prisma[model] as any).aggregate({ _max: { id: true } });
    return (r._max.id ?? 0) + 1;
  }

  async createService(me: AuthUser, dto: ServiceDto) {
    const id = await this.nextId('service');
    const out = await this.prisma.service.create({ data: { id, ...dto, terms: dto.terms ?? '' } });
    await this.audit(me, 'service.create', `service:${id}`, { name: dto.name });
    return out;
  }
  async updateService(me: AuthUser, id: number, dto: PatchServiceDto) {
    await this.must(this.prisma.service.findUnique({ where: { id } }));
    const out = await this.prisma.service.update({ where: { id }, data: dto });
    await this.audit(me, 'service.update', `service:${id}`, dto);
    return out;
  }
  async deleteService(me: AuthUser, id: number) {
    if (await this.prisma.booking.count({ where: { serviceId: id } })) throw new ConflictException('This service has bookings and cannot be deleted.');
    await this.must(this.prisma.service.findUnique({ where: { id } }));
    await this.prisma.service.delete({ where: { id } });
    await this.audit(me, 'service.delete', `service:${id}`);
  }

  listProviders() { return this.prisma.provider.findMany({ orderBy: { id: 'asc' }, include: { services: { select: { id: true, name: true } }, _count: { select: { bookings: true } } } }); }
  async createProvider(me: AuthUser, { serviceIds, ...dto }: ProviderDto) {
    const id = await this.nextId('provider');
    const out = await this.prisma.provider.create({ data: { id, ...dto, services: { connect: serviceIds.map((s) => ({ id: s })) } } });
    await this.audit(me, 'provider.create', `provider:${id}`, { name: dto.name });
    return out;
  }
  async updateProvider(me: AuthUser, id: number, { serviceIds, ...dto }: PatchProviderDto) {
    await this.must(this.prisma.provider.findUnique({ where: { id } }));
    const out = await this.prisma.provider.update({ where: { id }, data: { ...dto, ...(serviceIds ? { services: { set: serviceIds.map((s) => ({ id: s })) } } : {}) } });
    await this.audit(me, 'provider.update', `provider:${id}`, dto);
    return out;
  }
  /* Link (or unlink with email null) a login to a provider profile, promoting it to PROVIDER.
     This is how a pro gets app access, instead of running a server-side script per hire. */
  async linkProvider(me: AuthUser, id: number, email?: string | null) {
    const provider = await this.must(this.prisma.provider.findUnique({ where: { id } }));
    if (!email) {
      const out = await this.prisma.provider.update({ where: { id }, data: { userId: null } });
      await this.audit(me, 'provider.unlink', `provider:${id}`);
      return out;
    }
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) throw new NotFoundException('No account with that email. Ask them to register in the mobile app first.');
    const already = await this.prisma.provider.findUnique({ where: { userId: user.id } });
    if (already && already.id !== provider.id) throw new ConflictException('That account is already linked to another provider profile.');
    const [, updated] = await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: user.id }, data: { role: 'PROVIDER' } }),
      this.prisma.provider.update({ where: { id }, data: { userId: user.id } }),
    ]);
    await this.audit(me, 'provider.link', `provider:${id}`, { email: user.email });
    return updated;
  }

  async deleteProvider(me: AuthUser, id: number) {
    if (await this.prisma.booking.count({ where: { providerId: id, status: { in: ['REQUESTED', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'] } } })) {
      throw new ConflictException('This pro has open bookings. Reassign them first.');
    }
    await this.must(this.prisma.provider.findUnique({ where: { id } }));
    await this.prisma.booking.updateMany({ where: { providerId: id }, data: { providerId: null } });
    await this.prisma.provider.delete({ where: { id } });
    await this.audit(me, 'provider.delete', `provider:${id}`);
  }

  /* Payouts: what each pro has earned (net of their commission) from completed jobs, minus what they've been paid. */
  async listPayouts() {
    const providers = await this.prisma.provider.findMany({ orderBy: { id: 'asc' }, select: { id: true, name: true, commissionPercent: true } });
    const [earned, paid] = await Promise.all([
      this.prisma.booking.groupBy({ by: ['providerId'], where: { status: 'DONE', providerId: { not: null } }, _sum: { estimate: true } }),
      this.prisma.payout.groupBy({ by: ['providerId'], _sum: { amount: true } }),
    ]);
    const earnedMap = new Map(earned.map((e) => [e.providerId, e._sum.estimate ?? 0]));
    const paidMap = new Map(paid.map((p) => [p.providerId, p._sum.amount ?? 0]));
    return providers.map((p) => {
      const gross = earnedMap.get(p.id) ?? 0;
      const netEarned = Math.round(gross * (100 - p.commissionPercent) / 100);
      const paidOut = paidMap.get(p.id) ?? 0;
      return { providerId: p.id, name: p.name, commissionPercent: p.commissionPercent, grossEarned: gross, netEarned, paidOut, balanceDue: Math.max(0, netEarned - paidOut) };
    });
  }

  providerPayouts(id: number) {
    return this.prisma.payout.findMany({ where: { providerId: id }, orderBy: { createdAt: 'desc' } });
  }

  private async providerBalance(providerId: number) {
    const provider = await this.must(this.prisma.provider.findUnique({ where: { id: providerId } }));
    const [earned, paidOut] = await Promise.all([
      this.prisma.booking.aggregate({ _sum: { estimate: true }, where: { providerId, status: 'DONE' } }),
      this.prisma.payout.aggregate({ _sum: { amount: true }, where: { providerId } }),
    ]);
    const netEarned = Math.round((earned._sum.estimate ?? 0) * (100 - provider.commissionPercent) / 100);
    const paid = paidOut._sum.amount ?? 0;
    return { provider, due: Math.max(0, netEarned - paid) };
  }

  async recordPayout(me: AuthUser, dto: RecordPayoutDto) {
    const { provider, due } = await this.providerBalance(dto.providerId);
    if (dto.amount > due) throw new BadRequestException(`Balance due is only ${due}.`);
    const out = await this.prisma.payout.create({ data: { providerId: provider.id, amount: dto.amount, note: dto.note ?? '', createdBy: me.email } });
    await this.audit(me, 'payout.create', `provider:${provider.id}`, { amount: dto.amount, note: dto.note });
    return out;
  }

  async createProduct(me: AuthUser, dto: ProductDto) {
    const id = await this.nextId('product');
    const out = await this.prisma.product.create({ data: { id, ...dto } });
    await this.audit(me, 'product.create', `product:${id}`, { name: dto.name });
    return out;
  }
  async updateProduct(me: AuthUser, id: number, dto: PatchProductDto) {
    await this.must(this.prisma.product.findUnique({ where: { id } }));
    const out = await this.prisma.product.update({ where: { id }, data: dto });
    await this.audit(me, 'product.update', `product:${id}`, dto);
    return out;
  }
  async deleteProduct(me: AuthUser, id: number) {
    if (await this.prisma.orderItem.count({ where: { productId: id } })) throw new ConflictException('This product appears in orders and cannot be deleted.');
    await this.must(this.prisma.product.findUnique({ where: { id } }));
    await this.prisma.product.delete({ where: { id } });
    await this.audit(me, 'product.delete', `product:${id}`);
  }

  /* Banners */
  listBanners() { return this.prisma.banner.findMany({ orderBy: [{ sort: 'asc' }, { id: 'desc' }] }); }
  private async cleanBanner(dto: Partial<BannerDto>) {
    const data: any = Object.fromEntries(Object.entries(dto).filter(([, v]) => v !== undefined));
    if ('coupon' in data) {
      const code = (data.coupon ?? '').trim().toUpperCase();
      if (code && !(await this.prisma.coupon.findUnique({ where: { code } }))) throw new BadRequestException('That coupon code does not exist.');
      data.coupon = code || null;
    }
    if ('img' in data) data.img = data.img?.trim() || null;
    if ('serviceId' in data && data.serviceId) await this.must(this.prisma.service.findUnique({ where: { id: data.serviceId } }));
    if ('serviceId' in data && !data.serviceId) data.serviceId = null;
    return data;
  }
  async createBanner(me: AuthUser, dto: BannerDto) {
    const out = await this.prisma.banner.create({ data: await this.cleanBanner(dto) });
    await this.audit(me, 'banner.create', `banner:${out.id}`, { title: dto.title });
    return out;
  }
  async updateBanner(me: AuthUser, id: number, dto: PatchBannerDto) {
    await this.must(this.prisma.banner.findUnique({ where: { id } }));
    const out = await this.prisma.banner.update({ where: { id }, data: await this.cleanBanner(dto) });
    await this.audit(me, 'banner.update', `banner:${id}`, dto);
    return out;
  }
  async deleteBanner(me: AuthUser, id: number) {
    await this.must(this.prisma.banner.findUnique({ where: { id } }));
    await this.prisma.banner.delete({ where: { id } });
    await this.audit(me, 'banner.delete', `banner:${id}`);
  }

  /* Coupons, reviews, messages */
  listCoupons() { return this.prisma.coupon.findMany({ orderBy: { code: 'asc' } }); }
  async createCoupon(me: AuthUser, dto: CouponDto) {
    if (await this.prisma.coupon.findUnique({ where: { code: dto.code } })) throw new ConflictException('That code already exists.');
    const out = await this.prisma.coupon.create({ data: { code: dto.code, percent: dto.percent, active: dto.active ?? true } });
    await this.audit(me, 'coupon.create', `coupon:${dto.code}`, { percent: dto.percent });
    return out;
  }
  async updateCoupon(me: AuthUser, code: string, dto: PatchCouponDto) {
    await this.must(this.prisma.coupon.findUnique({ where: { code } }));
    const out = await this.prisma.coupon.update({ where: { code }, data: dto });
    await this.audit(me, 'coupon.update', `coupon:${code}`, dto);
    return out;
  }
  async deleteCoupon(me: AuthUser, code: string) {
    await this.must(this.prisma.coupon.findUnique({ where: { code } }));
    await this.prisma.coupon.delete({ where: { code } });
    await this.audit(me, 'coupon.delete', `coupon:${code}`);
  }

  listReviews(skip?: string) { return this.prisma.review.findMany({ orderBy: { createdAt: 'desc' }, ...page(skip), include: { user: { select: { name: true, email: true } } } }); }
  async deleteReview(me: AuthUser, id: string) {
    await this.must(this.prisma.review.findUnique({ where: { id } }));
    await this.prisma.review.delete({ where: { id } });
    await this.audit(me, 'review.delete', `review:${id}`);
  }

  listMessages(skip?: string) { return this.prisma.contactMessage.findMany({ orderBy: { createdAt: 'desc' }, ...page(skip) }); }
  async deleteMessage(me: AuthUser, id: string) {
    await this.must(this.prisma.contactMessage.findUnique({ where: { id } }));
    await this.prisma.contactMessage.delete({ where: { id } });
    await this.audit(me, 'message.delete', `message:${id}`);
  }

  private async must<T>(p: Promise<T | null>) { const r = await p; if (!r) throw new NotFoundException(); return r; }

  /* Notifications */
  async broadcastNotification(me: AuthUser, dto: BroadcastDto) {
    const userIds = dto.audience === 'ALL' ? null : (await this.prisma.user.findMany({ where: { role: dto.audience }, select: { id: true } })).map((u) => u.id);
    if (userIds && !userIds.length) throw new BadRequestException('No users match that audience.');
    const { sent } = await this.push.broadcast(userIds, dto.text, dto.title, dto.href || '/');
    const recipients = userIds ? userIds.length : await this.prisma.user.count();
    await this.audit(me, 'notification.broadcast', `audience:${dto.audience}`, { title: dto.title, text: dto.text, recipients, sent });
    return { recipients, sent };
  }

  /* Admin accounts: promote an existing user to ADMIN by email, or demote one back to CUSTOMER. */
  listAdmins() {
    return this.prisma.user.findMany({ where: { role: Role.ADMIN }, orderBy: { createdAt: 'asc' }, select: { id: true, name: true, email: true, phone: true, createdAt: true } });
  }
  async promoteAdmin(me: AuthUser, email: string) {
    const user = await this.prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    if (!user) throw new NotFoundException('No account with that email. Ask them to register in the app first.');
    if (user.role === Role.ADMIN) throw new ConflictException('That user is already an admin.');
    const out = await this.prisma.user.update({ where: { id: user.id }, data: { role: Role.ADMIN }, select: { id: true, name: true, email: true, phone: true, createdAt: true } });
    await this.audit(me, 'admin.promote', `user:${user.id}`, { email: user.email });
    return out;
  }
  async demoteAdmin(me: AuthUser, id: string) {
    if (me.id === id) throw new BadRequestException('You cannot remove your own admin access.');
    const user = await this.must(this.prisma.user.findUnique({ where: { id } }));
    if (user.role !== Role.ADMIN) throw new BadRequestException('That user is not an admin.');
    await this.prisma.user.update({ where: { id }, data: { role: Role.CUSTOMER } });
    await this.audit(me, 'admin.demote', `user:${id}`, { email: user.email });
  }
}

@Controller('admin')
@UseGuards(JwtAuthGuard)
@Roles(Role.ADMIN)
class AdminController {
  constructor(private svc: AdminService) {}

  @Get('stats') stats() { return this.svc.stats(); }

  @Get('bookings') bookings(@Query() q: any) { return this.svc.listBookings(q); }
  @Patch('bookings/:id/provider') assign(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: BookingAssignDto) { return this.svc.assign(me, id, dto.providerId ?? null); }

  @Get('orders') orders(@Query() q: any) { return this.svc.listOrders(q); }
  @Patch('orders/:id/status') orderStatus(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: OrderStatusDto) { return this.svc.setOrderStatus(me, id, dto.status); }

  @Get('users') users(@Query() q: any) { return this.svc.listUsers(q); }
  @Patch('users/:id/role') role(@CurrentUser() me: AuthUser, @Param('id') id: string, @Body() dto: RoleDto) { return this.svc.setRole(me, id, dto.role); }

  @Post('services') createService(@CurrentUser() me: AuthUser, @Body() dto: ServiceDto) { return this.svc.createService(me, dto); }
  @Patch('services/:id') updateService(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PatchServiceDto) { return this.svc.updateService(me, id, dto); }
  @Delete('services/:id') @HttpCode(204) deleteService(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.svc.deleteService(me, id); }

  @Get('providers') providers() { return this.svc.listProviders(); }
  @Post('providers') createProvider(@CurrentUser() me: AuthUser, @Body() dto: ProviderDto) { return this.svc.createProvider(me, dto); }
  @Patch('providers/:id') updateProvider(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PatchProviderDto) { return this.svc.updateProvider(me, id, dto); }
  @Patch('providers/:id/link') linkProvider(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: LinkProviderDto) { return this.svc.linkProvider(me, id, dto.email); }
  @Delete('providers/:id') @HttpCode(204) deleteProvider(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.svc.deleteProvider(me, id); }

  @Get('payouts') payouts() { return this.svc.listPayouts(); }
  @Get('payouts/:providerId') providerPayouts(@Param('providerId', ParseIntPipe) id: number) { return this.svc.providerPayouts(id); }
  @Post('payouts') recordPayout(@CurrentUser() me: AuthUser, @Body() dto: RecordPayoutDto) { return this.svc.recordPayout(me, dto); }

  @Post('products') createProduct(@CurrentUser() me: AuthUser, @Body() dto: ProductDto) { return this.svc.createProduct(me, dto); }
  @Patch('products/:id') updateProduct(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PatchProductDto) { return this.svc.updateProduct(me, id, dto); }
  @Delete('products/:id') @HttpCode(204) deleteProduct(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.svc.deleteProduct(me, id); }

  @Get('banners') banners() { return this.svc.listBanners(); }
  @Post('banners') createBanner(@CurrentUser() me: AuthUser, @Body() dto: BannerDto) { return this.svc.createBanner(me, dto); }
  @Patch('banners/:id') updateBanner(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PatchBannerDto) { return this.svc.updateBanner(me, id, dto); }
  @Delete('banners/:id') @HttpCode(204) deleteBanner(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.svc.deleteBanner(me, id); }

  @Get('coupons') coupons() { return this.svc.listCoupons(); }
  @Post('coupons') createCoupon(@CurrentUser() me: AuthUser, @Body() dto: CouponDto) { return this.svc.createCoupon(me, dto); }
  @Patch('coupons/:code') updateCoupon(@CurrentUser() me: AuthUser, @Param('code') code: string, @Body() dto: PatchCouponDto) { return this.svc.updateCoupon(me, code, dto); }
  @Delete('coupons/:code') @HttpCode(204) deleteCoupon(@CurrentUser() me: AuthUser, @Param('code') code: string) { return this.svc.deleteCoupon(me, code); }

  @Get('reviews') reviews(@Query('skip') skip?: string) { return this.svc.listReviews(skip); }
  @Delete('reviews/:id') @HttpCode(204) deleteReview(@CurrentUser() me: AuthUser, @Param('id') id: string) { return this.svc.deleteReview(me, id); }

  @Get('messages') messages(@Query('skip') skip?: string) { return this.svc.listMessages(skip); }
  @Delete('messages/:id') @HttpCode(204) deleteMessage(@CurrentUser() me: AuthUser, @Param('id') id: string) { return this.svc.deleteMessage(me, id); }

  @Get('audit-log') auditLog(@Query() q: any) { return this.svc.listAuditLog(q); }

  @Post('notifications/broadcast') broadcast(@CurrentUser() me: AuthUser, @Body() dto: BroadcastDto) { return this.svc.broadcastNotification(me, dto); }

  @Get('admins') admins() { return this.svc.listAdmins(); }
  @Post('admins') promoteAdmin(@CurrentUser() me: AuthUser, @Body() dto: PromoteAdminDto) { return this.svc.promoteAdmin(me, dto.email); }
  @Delete('admins/:id') @HttpCode(204) demoteAdmin(@CurrentUser() me: AuthUser, @Param('id') id: string) { return this.svc.demoteAdmin(me, id); }
}

@Module({ imports: [PaymentsModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
