import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { randomInt } from 'crypto';
import { IsBoolean, IsIn, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/auth';
import { PushService } from '../common/push';
import { distanceKm } from '../common/geo';
import { STATUS_TEXT, omitOtp } from '../bookings/bookings.module';

class OnlineDto { @IsBoolean() online: boolean; }
class ProfileDto {
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) response?: string;
}
class ReleaseDto { @IsString() @MinLength(3) @MaxLength(200) reason: string; }
class KycDto {
  @IsIn(['AADHAAR', 'PAN', 'DRIVING_LICENCE', 'VOTER_ID']) docType: string;
  @IsString() @MinLength(4) @MaxLength(30) docNumber: string;
  @IsString() @MinLength(20) @MaxLength(2000000) docImage: string;
}
class PhotoDto {
  @IsIn(['BEFORE', 'AFTER']) kind: string;
  @IsString() @MinLength(20) @MaxLength(2000000) image: string;
}
const IMAGE = /^data:image\/(jpeg|png|webp);base64,/;
class LocationDto { @IsOptional() lat?: number; @IsOptional() lng?: number; }

@Injectable()
class ProService {
  constructor(private prisma: PrismaService, private push: PushService) {}

  private async mine(userId: string) {
    const p = await this.prisma.provider.findUnique({ where: { userId } });
    if (!p) throw new ForbiddenException('No provider profile is linked to this account.');
    return p;
  }

  async me(userId: string) {
    const p = await this.mine(userId);
    const [done, earnings, rating] = await Promise.all([
      this.prisma.booking.count({ where: { providerId: p.id, status: 'DONE' } }),
      this.prisma.booking.aggregate({ _sum: { estimate: true }, where: { providerId: p.id, status: 'DONE' } }),
      this.prisma.review.aggregate({ _avg: { rating: true }, where: { kind: 'service', booking: { providerId: p.id } } }),
    ]);
    const earned = Math.round((earnings._sum.estimate ?? 0) * (100 - p.commissionPercent) / 100);
    return { ...p, done, earned, rating: rating._avg.rating ?? null };
  }

  /* Only approved pros can take work. */
  private async approved(userId: string) {
    const p = await this.mine(userId);
    if (p.kycStatus !== 'APPROVED') throw new ForbiddenException('Complete identity verification and wait for approval before taking jobs.');
    return p;
  }

  async kyc(userId: string) {
    const p = await this.mine(userId);
    const k = await this.prisma.providerKyc.findUnique({ where: { providerId: p.id }, select: { docType: true, docNumber: true, submittedAt: true } });
    const n = k?.docNumber;
    return { status: p.kycStatus, docType: k?.docType ?? null, docNumber: n ? '•'.repeat(Math.max(0, n.length - 4)) + n.slice(-4) : null, note: p.kycNote, submittedAt: k?.submittedAt ?? null };
  }

  async submitKyc(userId: string, dto: KycDto) {
    const p = await this.mine(userId);
    if (p.kycStatus === 'APPROVED') throw new BadRequestException('You are already verified.');
    if (!IMAGE.test(dto.docImage)) throw new BadRequestException('Attach a JPG, PNG or WebP photo of the document.');
    const doc = { docType: dto.docType, docNumber: dto.docNumber.trim(), docImage: dto.docImage, submittedAt: new Date() };
    await this.prisma.$transaction([
      this.prisma.providerKyc.upsert({ where: { providerId: p.id }, create: { providerId: p.id, ...doc }, update: doc }),
      this.prisma.provider.update({ where: { id: p.id }, data: { kycStatus: 'PENDING', kycNote: null, online: false } }),
    ]);
    return this.kyc(userId);
  }

  async addPhoto(userId: string, id: string, dto: PhotoDto) {
    const p = await this.mine(userId);
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b || b.providerId !== p.id) throw new NotFoundException();
    if (b.status !== 'IN_PROGRESS' && b.status !== 'ON_THE_WAY') throw new BadRequestException('Photos can be added while the job is under way.');
    if (!IMAGE.test(dto.image)) throw new BadRequestException('Attach a JPG, PNG or WebP photo.');
    if (await this.prisma.jobPhoto.count({ where: { bookingId: id, kind: dto.kind } }) >= 4) throw new BadRequestException('You can attach up to 4 photos of each kind.');
    const out = await this.prisma.jobPhoto.create({ data: { bookingId: id, kind: dto.kind, data: dto.image } });
    return { id: out.id, kind: out.kind, createdAt: out.createdAt };
  }

  async setOnline(userId: string, online: boolean) {
    const p = online ? await this.approved(userId) : await this.mine(userId);
    return this.prisma.provider.update({ where: { id: p.id }, data: { online } });
  }

  async setLocation(userId: string, dto: LocationDto) {
    const p = await this.mine(userId);
    return this.prisma.provider.update({ where: { id: p.id }, data: { lat: dto.lat ?? null, lng: dto.lng ?? null } });
  }

  /* Open pool: unassigned requests for services I offer (only while online — an offline pro shouldn't
     see new work land), plus anything already assigned to me regardless of online status. Sorted
     nearest-first when both my location and the job's are known. */
  async requests(userId: string) {
    const p = await this.mine(userId);
    const ids = (await this.prisma.provider.findUnique({ where: { id: p.id }, include: { services: { select: { id: true } } } }))!.services.map((s) => s.id);
    const pool = p.online ? [{ providerId: null, serviceId: { in: ids } }] : [];
    const rows = await this.prisma.booking.findMany({
      where: { status: 'REQUESTED', OR: [...pool, { providerId: p.id }] },
      orderBy: { createdAt: 'desc' },
      include: { service: true },
    });
    if (p.lat == null || p.lng == null) return rows.map(omitOtp);
    return rows
      .map((b) => ({ ...omitOtp(b), distanceKm: b.lat != null && b.lng != null ? distanceKm(p.lat!, p.lng!, b.lat, b.lng) : null }))
      .sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity));
  }

  async jobs(userId: string) {
    const p = await this.mine(userId);
    const rows = await this.prisma.booking.findMany({
      where: { providerId: p.id, status: { not: 'REQUESTED' } },
      orderBy: { createdAt: 'desc' },
      include: { service: true },
    });
    return rows.map(omitOtp);
  }

  async accept(userId: string, id: string) {
    const p = await this.approved(userId);
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b || b.status !== 'REQUESTED') throw new NotFoundException('Request is no longer available.');
    if (b.providerId !== null && b.providerId !== p.id) throw new ConflictException('This request was taken by another pro.');
    const clash = await this.prisma.booking.findFirst({ where: { providerId: p.id, day: b.day, slot: b.slot, status: { not: 'CANCELLED' }, id: { not: id } } });
    if (clash) throw new ConflictException('You already have a job in this slot.');
    try {
      return await this.prisma.$transaction(async (tx) => {
        const r = await tx.booking.updateMany({ where: { id, status: 'REQUESTED', OR: [{ providerId: null }, { providerId: p.id }] }, data: { providerId: p.id, status: 'CONFIRMED' } });
        if (r.count !== 1) throw new ConflictException('This request was just taken by another pro.');
        const out = await tx.booking.findUniqueOrThrow({ where: { id }, include: { service: true } });
        await tx.notification.create({ data: { userId: b.userId, text: `#${id}: ${STATUS_TEXT.CONFIRMED}`, href: '/orders' } });
        return out;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }).then(async (out) => {
        await this.push.send(b.userId, `#${id}: ${STATUS_TEXT.CONFIRMED}`, 'Fixzy', { href: '/orders' });
        return omitOtp(out);
      });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) throw new ConflictException('This request was just taken by another pro.');
      throw e;
    }
  }

  async updateProfile(userId: string, dto: ProfileDto) {
    const p = await this.mine(userId);
    return this.prisma.provider.update({ where: { id: p.id }, data: { ...(dto.bio !== undefined && { bio: dto.bio }), ...(dto.response !== undefined && { response: dto.response }) } });
  }

  /* Totals for completed jobs (by job day) plus a per-day series for the last 14 days, net of
     platform commission, alongside what has actually been paid out so far. */
  async earnings(userId: string) {
    const p = await this.mine(userId);
    const iso = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const net = (gross: number) => Math.round(gross * (100 - p.commissionPercent) / 100);
    const rows = await this.prisma.booking.findMany({ where: { providerId: p.id, status: 'DONE', day: { gte: iso(29) } }, select: { day: true, estimate: true } });
    const sum = (from: string) => net(rows.filter((r) => r.day >= from).reduce((a, r) => a + r.estimate, 0));
    const daily = Array.from({ length: 14 }, (_, i) => {
      const day = iso(13 - i);
      const list = rows.filter((r) => r.day === day);
      return { day, jobs: list.length, amount: net(list.reduce((a, r) => a + r.estimate, 0)) };
    });
    const [lifetime, upcoming, paidOut] = await Promise.all([
      this.prisma.booking.aggregate({ _sum: { estimate: true }, _count: true, where: { providerId: p.id, status: 'DONE' } }),
      this.prisma.booking.count({ where: { providerId: p.id, status: { in: ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'] } } }),
      this.prisma.payout.aggregate({ _sum: { amount: true }, where: { providerId: p.id } }),
    ]);
    const lifetimeNet = net(lifetime._sum.estimate ?? 0);
    const paid = paidOut._sum.amount ?? 0;
    return {
      today: sum(iso(0)), week: sum(iso(6)), month: sum(iso(29)),
      lifetime: lifetimeNet, jobs: lifetime._count, upcoming, daily,
      commissionPercent: p.commissionPercent, paidOut: paid, balanceDue: Math.max(0, lifetimeNet - paid),
    };
  }

  async payouts(userId: string) {
    const p = await this.mine(userId);
    return this.prisma.payout.findMany({ where: { providerId: p.id }, orderBy: { createdAt: 'desc' } });
  }

  /* Reviews customers left for this pro: summary (average, count, 1-5 breakdown) plus the latest 50. Customers appear by first name only. */
  async reviews(userId: string) {
    const p = await this.mine(userId);
    // Customers review the service on a completed booking, so a pro's reviews are the ones left on their bookings.
    const where = { kind: 'service', booking: { providerId: p.id } };
    const [rows, agg, groups] = await Promise.all([
      this.prisma.review.findMany({
        where, orderBy: { createdAt: 'desc' }, take: 50,
        include: { user: { select: { name: true } }, booking: { select: { service: { select: { name: true } } } } },
      }),
      this.prisma.review.aggregate({ where, _avg: { rating: true }, _count: true }),
      this.prisma.review.groupBy({ by: ['rating'], where, _count: true }),
    ]);
    const breakdown = [5, 4, 3, 2, 1].map((stars) => ({ stars, count: groups.find((g) => g.rating === stars)?._count ?? 0 }));
    return {
      average: agg._avg.rating ?? null,
      count: agg._count,
      breakdown,
      items: rows.map((r) => ({ id: r.id, rating: r.rating, text: r.text, createdAt: r.createdAt, customer: r.user.name.split(' ')[0], service: r.booking?.service.name ?? null })),
    };
  }

  /* Give a confirmed job back to the pool (before the trip starts). The customer is told and another pro can pick it up. */
  async release(userId: string, id: string, reason: string) {
    const p = await this.mine(userId);
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b || b.providerId !== p.id) throw new NotFoundException();
    if (b.status !== 'CONFIRMED') throw new BadRequestException('Only confirmed jobs that have not started can be released. Contact support for anything else.');
    return this.prisma.$transaction(async (tx) => {
      const out = await tx.booking.update({ where: { id }, data: { providerId: null, status: 'REQUESTED' }, include: { service: true } });
      await tx.notification.create({ data: { userId: b.userId, text: `#${id}: Your pro can no longer make it (${reason}). We're finding you another pro.`, href: '/orders' } });
      return out;
    }).then(async (out) => {
      await this.push.send(b.userId, `#${id}: Your pro can no longer make it. We're finding you another pro.`, 'Fixzy', { href: '/orders' });
      return out;
    });
  }

  /* The pro tapped "Start work": tell the customer right now (push + in-app) so their start code pops up full-screen. */
  async requestCode(userId: string, id: string) {
    const p = await this.mine(userId);
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b || b.providerId !== p.id) throw new NotFoundException();
    if (b.status !== 'ON_THE_WAY' && b.status !== 'IN_PROGRESS') throw new BadRequestException('A code can only be requested while the job is on the way or in progress.');
    if (!b.otp) await this.prisma.booking.update({ where: { id }, data: { otp: String(randomInt(1000, 10000)) } });
    const start = b.status === 'ON_THE_WAY';
    await this.push.alert(b.userId, start ? `#${id}: Your pro is ready to start. Open the app and share your start code.` : `#${id}: Your pro has finished the work. Open the app and share your completion code once you're happy.`, start ? 'Share your start code' : 'Share your completion code', `/booking/${id}?code=1`);
    return { ok: true };
  }

  async decline(userId: string, id: string) {
    const p = await this.mine(userId);
    const b = await this.prisma.booking.findUnique({ where: { id } });
    if (!b || b.status !== 'REQUESTED') throw new NotFoundException();
    // Directly-assigned request: free it back to the pool. A pool request simply disappears from this pro's feed (client hides it).
    if (b.providerId === p.id) return this.prisma.booking.update({ where: { id }, data: { providerId: null } });
    if (b.providerId !== null) throw new BadRequestException('This request is not assigned to you.');
    return b;
  }
}

@Controller('pro')
@UseGuards(JwtAuthGuard)
@Roles(Role.PROVIDER)
class ProController {
  constructor(private svc: ProService) {}
  @Post('bookings/:id/request-code') requestCode(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.requestCode(u.id, id); }
  @Get('me') me(@CurrentUser() u: AuthUser) { return this.svc.me(u.id); }
  @Patch('online') online(@CurrentUser() u: AuthUser, @Body() dto: OnlineDto) { return this.svc.setOnline(u.id, dto.online); }
  @Patch('location') location(@CurrentUser() u: AuthUser, @Body() dto: LocationDto) { return this.svc.setLocation(u.id, dto); }
  @Get('kyc') kyc(@CurrentUser() u: AuthUser) { return this.svc.kyc(u.id); }
  @Post('kyc') submitKyc(@CurrentUser() u: AuthUser, @Body() dto: KycDto) { return this.svc.submitKyc(u.id, dto); }
  @Post('bookings/:id/photos') addPhoto(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: PhotoDto) { return this.svc.addPhoto(u.id, id, dto); }
  @Get('earnings') earnings(@CurrentUser() u: AuthUser) { return this.svc.earnings(u.id); }
  @Get('payouts') payouts(@CurrentUser() u: AuthUser) { return this.svc.payouts(u.id); }
  @Get('reviews') reviews(@CurrentUser() u: AuthUser) { return this.svc.reviews(u.id); }
  @Patch('profile') profile(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) { return this.svc.updateProfile(u.id, dto); }
  @Post('bookings/:id/release') release(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReleaseDto) { return this.svc.release(u.id, id, dto.reason); }
  @Get('requests') requests(@CurrentUser() u: AuthUser) { return this.svc.requests(u.id); }
  @Get('jobs') jobs(@CurrentUser() u: AuthUser) { return this.svc.jobs(u.id); }
  @Post('bookings/:id/accept') accept(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.accept(u.id, id); }
  @Post('bookings/:id/decline') decline(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.decline(u.id, id); }
}

@Module({ controllers: [ProController], providers: [ProService] })
export class ProModule {}
