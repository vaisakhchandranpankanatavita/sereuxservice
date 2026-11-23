import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { BookingStatus, Prisma, Role } from '@prisma/client';
import { IsIn, IsInt, IsOptional, IsString, Matches, Max, MaxLength, MinLength, Min } from 'class-validator';
import { randomBytes, randomInt } from 'crypto';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/auth';
import { PaymentsModule, PaymentsService } from '../payments/payments.module';
import { PushService } from '../common/push';
import { ConfigService } from '../config/config.module';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const FLOW: BookingStatus[] = ['REQUESTED', 'CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS', 'DONE'];
export const STATUS_TEXT: Record<BookingStatus, string> = {
  REQUESTED: 'Your booking was received.',
  CONFIRMED: 'Your booking is confirmed.',
  ON_THE_WAY: 'Your pro is on the way.',
  IN_PROGRESS: 'Work has started.',
  DONE: 'Your job is complete. How did it go?',
  CANCELLED: 'Your booking was cancelled.',
};

class CreateBookingDto {
  @IsInt() serviceId: number;
  @IsOptional() @IsInt() providerId?: number;
  @Matches(DAY) day: string;
  @Matches(/^\d{2}:\d{2}$/) slot: string;
  @IsString() @MaxLength(80) name: string;
  @Matches(/^[0-9+\s-]{8,15}$/) phone: string;
  @IsString() @MaxLength(300) address: string;
  @IsOptional() lat?: number;
  @IsOptional() lng?: number;
  @IsOptional() @IsString() @MaxLength(1000) notes?: string;
  @IsOptional() @IsString() @MaxLength(32) coupon?: string;
}

class UpdateBookingDto {
  @IsOptional() @Matches(DAY) day?: string;
  @IsOptional() @Matches(/^\d{2}:\d{2}$/) slot?: string;
  @IsOptional() @IsIn(['CANCELLED']) status?: 'CANCELLED';
  @IsOptional() @IsString() @MaxLength(300) reason?: string;
}

class ExtraDto {
  @IsString() @MinLength(3) @MaxLength(80) label: string;
  @IsInt() @Min(1) @Max(100000) amount: number;
}
class DecideExtraDto { @IsIn(['APPROVED', 'REJECTED']) status: 'APPROVED' | 'REJECTED'; }

class SetStatusDto {
  @IsIn(Object.keys(STATUS_TEXT)) status: BookingStatus;
  @IsOptional() @IsString() @MaxLength(8) otp?: string;
}

/* The OTP is a secret shared between the customer and the pro on site; the pro must be told it in person. */
export const omitOtp = <T extends { otp?: string | null }>(b: T): Omit<T, 'otp'> => { const { otp: _otp, ...rest } = b; return rest; };
const newOtp = () => String(randomInt(1000, 10000));

const isoToday = () => new Date().toISOString().slice(0, 10);
const addDays = (n: number) => new Date(Date.now() + n * 864e5).toISOString().slice(0, 10);
const newId = () => 'FX' + randomBytes(4).toString('hex').toUpperCase();

@Injectable()
class BookingsService {
  constructor(private prisma: PrismaService, private push: PushService, private payments: PaymentsService, private config: ConfigService) {}

  /* The bookable window and slot times are admin settings (rules.maxDaysAhead / rules.bookingSlots). */
  private async assertWindow(day: string, slot?: string) {
    const [max, slots] = await Promise.all([this.config.get<number>('rules.maxDaysAhead'), this.config.get<string[]>('rules.bookingSlots')]);
    if (day <= isoToday() || day > addDays(max)) throw new BadRequestException(`Pick a day within the next ${max} days.`);
    if (slot && !slots.includes(slot)) throw new BadRequestException('Pick one of the available time slots.');
  }

  private async assertFree(tx: Prisma.TransactionClient, where: { providerId?: number | null; serviceId: number }, day: string, slot: string, ignoreId?: string) {
    const clash = await tx.booking.findFirst({
      where: { day, slot, status: { not: 'CANCELLED' }, id: ignoreId ? { not: ignoreId } : undefined, ...(where.providerId ? { providerId: where.providerId } : { serviceId: where.serviceId, providerId: null }) },
    });
    if (clash) throw new ConflictException('That slot was just taken. Please pick another.');
  }

  async create(user: AuthUser, dto: CreateBookingDto) {
    await this.assertWindow(dto.day, dto.slot);
    const service = await this.prisma.service.findUnique({ where: { id: dto.serviceId }, include: { providers: { select: { id: true } } } });
    if (!service) throw new NotFoundException('Service not found.');
    if (dto.providerId && !service.providers.some((p) => p.id === dto.providerId)) throw new BadRequestException('That pro does not offer this service.');
    let coupon: string | null = null;
    let discount = 0;
    if (dto.coupon?.trim()) {
      const c = await this.prisma.coupon.findUnique({ where: { code: dto.coupon.trim().toUpperCase() } });
      if (!c?.active) throw new BadRequestException('That code isn’t valid.');
      coupon = c.code;
      discount = Math.round(service.fromPrice * (c.percent / 100));
    }
    const id = newId();
    try {
      const created = await this.prisma.$transaction(async (tx) => {
        await this.assertFree(tx, { providerId: dto.providerId, serviceId: dto.serviceId }, dto.day, dto.slot);
        const booking = await tx.booking.create({
          data: { id, userId: user.id, serviceId: dto.serviceId, providerId: dto.providerId ?? null, day: dto.day, slot: dto.slot, name: dto.name, phone: dto.phone, address: dto.address, lat: dto.lat ?? null, lng: dto.lng ?? null, notes: dto.notes ?? '', estimate: service.fromPrice - discount, coupon, discount },
        });
        await tx.notification.create({ data: { userId: user.id, text: `Booking #${id} received. We'll confirm shortly.`, href: '/orders' } });
        return booking;
      }, { isolationLevel: 'Serializable' });
      await this.alertPros(created.id, service.name, dto.day, dto.slot, dto.providerId).catch(() => {});
      await this.push.send(user.id, `Booking #${created.id} received. We'll confirm shortly.`, 'Fixzy', { href: '/orders' });
      return created;
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && (e.code === 'P2002' || e.code === 'P2034')) {
        throw new ConflictException('That slot was just taken. Please pick another.');
      }
      throw e;
    }
  }

  /* New request: tell the chosen pro, or every online pro who offers the service when none was picked. */
  private async alertPros(id: string, service: string, day: string, slot: string, providerId?: number) {
    const pros = await this.prisma.provider.findMany({
      where: { userId: { not: null }, ...(providerId ? { id: providerId } : { online: true, services: { some: { name: service } } }) },
      select: { userId: true },
    });
    await Promise.all(pros.map((p) => this.push.alert(p.userId!, `New ${service} request for ${day}, ${slot} (#${id}).`, 'New job request')));
  }

  /* A trip/job that is under way must always have a code for the customer (covers rows moved on before codes existed). */
  private async ensureOtp<T extends { id: string; status: string; otp?: string | null }>(b: T): Promise<T> {
    if (b.otp || (b.status !== 'ON_THE_WAY' && b.status !== 'IN_PROGRESS')) return b;
    const otp = newOtp();
    await this.prisma.booking.update({ where: { id: b.id }, data: { otp } });
    return { ...b, otp };
  }

  async list(user: AuthUser) {
    const rows = await this.prisma.booking.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, include: { service: true, provider: true, review: true, extras: { orderBy: { createdAt: 'asc' } }, payment: { select: { status: true, amount: true } } } });
    return Promise.all(rows.map((b) => this.ensureOtp(b)));
  }

  async get(user: AuthUser, id: string) {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { service: true, provider: true, review: true, extras: { orderBy: { createdAt: 'asc' } }, payment: { select: { status: true, amount: true } } } });
    if (!b) throw new NotFoundException();
    if (user.role === 'CUSTOMER' && b.userId !== user.id) throw new NotFoundException();
    if (user.role === 'PROVIDER' && b.provider?.userId !== user.id) throw new NotFoundException();
    return user.role === 'PROVIDER' ? omitOtp(b) : this.ensureOtp(b);
  }

  /* Before/after photos a pro attached to a job. Visible to the customer, the assigned pro and admins. */
  async photos(user: AuthUser, id: string) {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { provider: { select: { userId: true } } } });
    if (!b) throw new NotFoundException();
    const ok = user.role === 'ADMIN' || b.userId === user.id || b.provider?.userId === user.id;
    if (!ok) throw new NotFoundException();
    return this.prisma.jobPhoto.findMany({ where: { bookingId: id }, orderBy: { createdAt: 'asc' } });
  }

  /* Late-cancellation policy (admin settings). No fee while no pro is confirmed or while more than
     rules.cancelFreeHours remain before the slot; otherwise rules.cancelFeePercent of the total. */
  private async policy(b: { status: BookingStatus; day: string; slot: string; estimate: number }) {
    const [freeHours, percent] = await Promise.all([this.config.get<number>('rules.cancelFreeHours'), this.config.get<number>('rules.cancelFeePercent')]);
    const start = new Date(`${b.day}T${b.slot}:00+05:30`).getTime();
    const hoursLeft = (start - Date.now()) / 36e5;
    const free = b.status === 'REQUESTED' || (b.status === 'CONFIRMED' && hoursLeft >= freeHours);
    return { freeHours, percent, hoursLeft, fee: free ? 0 : Math.round(b.estimate * percent / 100) };
  }

  /* What cancelling would cost, so the customer sees it before confirming. */
  async cancellation(user: AuthUser, id: string) {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { payment: { select: { status: true, amount: true } } } });
    if (!b || b.userId !== user.id) throw new NotFoundException();
    if (b.status === 'DONE' || b.status === 'CANCELLED') throw new BadRequestException('This booking can no longer be changed.');
    const p = await this.policy(b);
    const paid = b.payment?.status === 'PAID' ? Math.round(b.payment.amount / 100) : 0;
    return { fee: p.fee, freeHours: p.freeHours, percent: p.percent, paid, refund: Math.max(0, paid - p.fee) };
  }

  async update(user: AuthUser, id: string, dto: UpdateBookingDto) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b || b.userId !== user.id) throw new NotFoundException();
    if (b.status === 'DONE' || b.status === 'CANCELLED') throw new BadRequestException('This booking can no longer be changed.');
    if (dto.status === 'CANCELLED') {
      const { fee } = await this.policy(b);
      return this.prisma.$transaction(async (tx) => {
        const out = await tx.booking.update({ where: { id }, data: { status: 'CANCELLED', cancelReason: dto.reason?.trim() || null, cancelFee: fee } });
        await tx.notification.create({ data: { userId: user.id, text: `#${id}: ${STATUS_TEXT.CANCELLED}${fee ? ` A cancellation fee of ₹${fee} applies.` : ''}`, href: '/orders' } });
        return out;
      }).then(async (out) => {
        await this.payments.refundBookingIfPaid(id, fee);
        await this.push.send(user.id, `#${id}: ${STATUS_TEXT.CANCELLED}`, 'Fixzy', { href: '/orders' });
        if (b.providerId) {
          const p = await this.prisma.provider.findUnique({ where: { id: b.providerId }, select: { userId: true } });
          if (p?.userId) await this.push.alert(p.userId, `Job #${id} was cancelled by the customer.`, 'Job cancelled');
        }
        return out;
      });
    }
    const day = dto.day ?? b.day;
    const slot = dto.slot ?? b.slot;
    if (day === b.day && slot === b.slot) return b;
    if (b.status !== 'REQUESTED' && b.status !== 'CONFIRMED') throw new BadRequestException('Too late to reschedule.');
    await this.assertWindow(day, slot);
    return this.prisma.$transaction(async (tx) => {
      await this.assertFree(tx, { providerId: b.providerId, serviceId: b.serviceId }, day, slot, id);
      return tx.booking.update({ where: { id }, data: { day, slot } });
    }, { isolationLevel: 'Serializable' });
  }

  /* A pro proposes extra work or parts while the job is under way; nothing is charged until the customer approves. */
  async proposeExtra(user: AuthUser, id: string, dto: ExtraDto) {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { provider: { select: { userId: true } } } });
    if (!b || b.provider?.userId !== user.id) throw new NotFoundException();
    if (b.status !== 'ON_THE_WAY' && b.status !== 'IN_PROGRESS') throw new BadRequestException('Extra charges can be added while the job is under way.');
    if (await this.prisma.bookingExtra.count({ where: { bookingId: id, status: 'PENDING' } }) >= 3) throw new BadRequestException('Wait for the customer to answer the pending charges first.');
    const extra = await this.prisma.bookingExtra.create({ data: { bookingId: id, label: dto.label.trim(), amount: dto.amount } });
    const text = `#${id}: Your pro added "${extra.label}" for ₹${extra.amount}. Open the booking to approve or decline.`;
    await this.prisma.notification.create({ data: { userId: b.userId, text, href: `/booking/${id}` } });
    await this.push.alert(b.userId, text, 'Extra charge to approve', `/booking/${id}`);
    return extra;
  }

  /* The customer answers. Approval adds the amount to the booking total (so commission and earnings follow). */
  async decideExtra(user: AuthUser, id: string, extraId: string, status: 'APPROVED' | 'REJECTED') {
    const b = await this.prisma.booking.findUnique({ where: { id }, include: { provider: { select: { userId: true } } } });
    if (!b || b.userId !== user.id) throw new NotFoundException();
    if (b.status === 'DONE' || b.status === 'CANCELLED') throw new BadRequestException('This booking is closed.');
    const out = await this.prisma.$transaction(async (tx) => {
      const r = await tx.bookingExtra.updateMany({ where: { id: extraId, bookingId: id, status: 'PENDING' }, data: { status, decidedAt: new Date() } });
      if (r.count !== 1) throw new ConflictException('That charge was already answered.');
      const extra = await tx.bookingExtra.findUniqueOrThrow({ where: { id: extraId } });
      if (status === 'APPROVED') await tx.booking.update({ where: { id }, data: { estimate: { increment: extra.amount } } });
      return extra;
    });
    if (b.provider?.userId) await this.push.alert(b.provider.userId, `#${id}: Customer ${status === 'APPROVED' ? 'approved' : 'declined'} "${out.label}" (₹${out.amount}).`, 'Extra charge answered');
    return out;
  }

  async setStatus(user: AuthUser, id: string, status: BookingStatus, otp?: string) {
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b) throw new NotFoundException();
    if (user.role === 'PROVIDER') {
      const me = await this.prisma.provider.findUnique({ where: { userId: user.id } });
      if (!me || b.providerId !== me.id) throw new ForbiddenException('This job is not assigned to you.');
    }
    if (b.status === 'DONE' || b.status === 'CANCELLED') throw new BadRequestException('Booking is already closed.');
    if (status !== 'CANCELLED' && FLOW.indexOf(status) !== FLOW.indexOf(b.status) + 1) {
      throw new BadRequestException(`Status must move from ${b.status} to ${FLOW[FLOW.indexOf(b.status) + 1]}.`);
    }
    if (status === 'DONE' && await this.prisma.bookingExtra.count({ where: { bookingId: id, status: 'PENDING' } })) {
      throw new BadRequestException('The customer still has an extra charge to approve or decline.');
    }
    // Pros must prove they are with the customer: the customer reads out the code shown in their app to start and to finish the job. Admins can override.
    if (user.role === 'PROVIDER') {
      if ((status === 'IN_PROGRESS' || status === 'DONE') && b.otp && b.otp !== otp?.trim()) {
        throw new BadRequestException(status === 'IN_PROGRESS' ? 'Enter the start code shown in the customer’s app.' : 'Enter the completion code shown in the customer’s app.');
      }
    }
    const nextOtp: string | null | undefined = status === 'ON_THE_WAY' || status === 'IN_PROGRESS' ? newOtp() : status === 'DONE' || status === 'CANCELLED' ? null : undefined;
    return this.prisma.$transaction(async (tx) => {
      const out = await tx.booking.update({ where: { id }, data: { status, ...(nextOtp !== undefined && { otp: nextOtp }) } });
      await tx.notification.create({ data: { userId: b.userId, text: `#${id}: ${STATUS_TEXT[status]}${nextOtp ? ` Your ${status === 'ON_THE_WAY' ? 'start' : 'completion'} code is ${nextOtp}.` : ''}`, href: '/orders' } });
      return out;
    }).then(async (out) => {
      if (status === 'CANCELLED') await this.payments.refundBookingIfPaid(id);
      await this.push.send(b.userId, `#${id}: ${STATUS_TEXT[status]}`, 'Fixzy', { href: '/orders' });
      return user.role === 'PROVIDER' ? omitOtp(out) : out;
    });
  }
}

@Controller('bookings')
@UseGuards(JwtAuthGuard)
class BookingsController {
  constructor(private svc: BookingsService) {}
  @Post() create(@CurrentUser() u: AuthUser, @Body() dto: CreateBookingDto) { return this.svc.create(u, dto); }
  @Get() list(@CurrentUser() u: AuthUser) { return this.svc.list(u); }
  @Get(':id/cancellation') cancellation(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.cancellation(u, id); }
  @Get(':id/photos') photos(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.photos(u, id); }
  @Get(':id') get(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.get(u, id); }
  @Patch(':id') update(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: UpdateBookingDto) { return this.svc.update(u, id, dto); }
  @Post(':id/extras') @Roles(Role.PROVIDER)
  propose(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ExtraDto) { return this.svc.proposeExtra(u, id, dto); }
  @Patch(':id/extras/:extraId') @Roles(Role.CUSTOMER)
  decide(@CurrentUser() u: AuthUser, @Param('id') id: string, @Param('extraId') extraId: string, @Body() dto: DecideExtraDto) { return this.svc.decideExtra(u, id, extraId, dto.status); }
  @Patch(':id/status') @Roles(Role.PROVIDER, Role.ADMIN)
  setStatus(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SetStatusDto) { return this.svc.setStatus(u, id, dto.status, dto.otp); }
}

@Module({ imports: [PaymentsModule], controllers: [BookingsController], providers: [BookingsService] })
export class BookingsModule {}
