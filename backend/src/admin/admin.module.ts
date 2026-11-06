import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Injectable, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { BookingStatus, OrderStatus, Prisma, Role } from '@prisma/client';
import { IsArray, IsBoolean, IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min } from 'class-validator';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/auth';
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
}
class PatchProviderDto {
  @IsOptional() @IsString() @MaxLength(80) name?: string;
  @IsOptional() @IsInt() @Min(0) @Max(60) years?: number;
  @IsOptional() @IsString() @MaxLength(60) response?: string;
  @IsOptional() @IsBoolean() verified?: boolean;
  @IsOptional() @IsArray() @IsInt({ each: true }) serviceIds?: number[];
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

class BookingAssignDto {
  @IsOptional() @IsInt() providerId: number | null;
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
  constructor(private prisma: PrismaService, private payments: PaymentsService) {}

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
    const days: Record<string, { day: string; bookings: number; revenue: number }> = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 864e5).toISOString().slice(0, 10);
      days[d] = { day: d, bookings: 0, revenue: 0 };
    }
    for (const b of recentBookings) { const d = days[b.createdAt.toISOString().slice(0, 10)]; if (d) d.bookings++; }
    for (const o of recentOrders) { const d = days[o.createdAt.toISOString().slice(0, 10)]; if (d) d.revenue += o.total; }
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
    return this.prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' }, ...page(q.skip), include: { service: true, provider: true } });
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
    return this.prisma.order.findMany({ where, orderBy: { createdAt: 'desc' }, ...page(q.skip), include: { items: { include: { product: { select: { name: true } } } } } });
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

  @Post('products') createProduct(@CurrentUser() me: AuthUser, @Body() dto: ProductDto) { return this.svc.createProduct(me, dto); }
  @Patch('products/:id') updateProduct(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number, @Body() dto: PatchProductDto) { return this.svc.updateProduct(me, id, dto); }
  @Delete('products/:id') @HttpCode(204) deleteProduct(@CurrentUser() me: AuthUser, @Param('id', ParseIntPipe) id: number) { return this.svc.deleteProduct(me, id); }

  @Get('coupons') coupons() { return this.svc.listCoupons(); }
  @Post('coupons') createCoupon(@CurrentUser() me: AuthUser, @Body() dto: CouponDto) { return this.svc.createCoupon(me, dto); }
  @Patch('coupons/:code') updateCoupon(@CurrentUser() me: AuthUser, @Param('code') code: string, @Body() dto: PatchCouponDto) { return this.svc.updateCoupon(me, code, dto); }
  @Delete('coupons/:code') @HttpCode(204) deleteCoupon(@CurrentUser() me: AuthUser, @Param('code') code: string) { return this.svc.deleteCoupon(me, code); }

  @Get('reviews') reviews(@Query('skip') skip?: string) { return this.svc.listReviews(skip); }
  @Delete('reviews/:id') @HttpCode(204) deleteReview(@CurrentUser() me: AuthUser, @Param('id') id: string) { return this.svc.deleteReview(me, id); }

  @Get('messages') messages(@Query('skip') skip?: string) { return this.svc.listMessages(skip); }
  @Delete('messages/:id') @HttpCode(204) deleteMessage(@CurrentUser() me: AuthUser, @Param('id') id: string) { return this.svc.deleteMessage(me, id); }

  @Get('audit-log') auditLog(@Query() q: any) { return this.svc.listAuditLog(q); }
}

@Module({ imports: [PaymentsModule], controllers: [AdminController], providers: [AdminService] })
export class AdminModule {}
