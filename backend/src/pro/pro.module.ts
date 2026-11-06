import { BadRequestException, Body, ConflictException, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { Prisma, Role } from '@prisma/client';
import { IsBoolean, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/auth';
import { STATUS_TEXT } from '../bookings/bookings.module';

class OnlineDto { @IsBoolean() online: boolean; }
class ProfileDto {
  @IsOptional() @IsString() @MaxLength(500) bio?: string;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(40) response?: string;
}
class ReleaseDto { @IsString() @MinLength(3) @MaxLength(200) reason: string; }
class LocationDto { @IsOptional() lat?: number; @IsOptional() lng?: number; }

@Injectable()
class ProService {
  constructor(private prisma: PrismaService) {}

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
      this.prisma.review.aggregate({ _avg: { rating: true }, where: { kind: 'provider', target: p.id } }),
    ]);
    return { ...p, done, earned: earnings._sum.estimate ?? 0, rating: rating._avg.rating ?? null };
  }

  async setOnline(userId: string, online: boolean) {
    const p = await this.mine(userId);
    return this.prisma.provider.update({ where: { id: p.id }, data: { online } });
  }

  async setLocation(userId: string, dto: LocationDto) {
    const p = await this.mine(userId);
    return this.prisma.provider.update({ where: { id: p.id }, data: { lat: dto.lat ?? null, lng: dto.lng ?? null } });
  }

  /* Open pool: unassigned requests for services I offer, plus anything already assigned to me. */
  async requests(userId: string) {
    const p = await this.mine(userId);
    const ids = (await this.prisma.provider.findUnique({ where: { id: p.id }, include: { services: { select: { id: true } } } }))!.services.map((s) => s.id);
    return this.prisma.booking.findMany({
      where: { status: 'REQUESTED', OR: [{ providerId: null, serviceId: { in: ids } }, { providerId: p.id }] },
      orderBy: { createdAt: 'desc' },
      include: { service: true },
    });
  }

  async jobs(userId: string) {
    const p = await this.mine(userId);
    return this.prisma.booking.findMany({
      where: { providerId: p.id, status: { not: 'REQUESTED' } },
      orderBy: { createdAt: 'desc' },
      include: { service: true },
    });
  }

  async accept(userId: string, id: string) {
    const p = await this.mine(userId);
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
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError) throw new ConflictException('This request was just taken by another pro.');
      throw e;
    }
  }

  async updateProfile(userId: string, dto: ProfileDto) {
    const p = await this.mine(userId);
    return this.prisma.provider.update({ where: { id: p.id }, data: { ...(dto.bio !== undefined && { bio: dto.bio }), ...(dto.response !== undefined && { response: dto.response }) } });
  }

  /* Totals for completed jobs (by job day) plus a per-day series for the last 14 days. */
  async earnings(userId: string) {
    const p = await this.mine(userId);
    const iso = (n: number) => new Date(Date.now() - n * 864e5).toISOString().slice(0, 10);
    const rows = await this.prisma.booking.findMany({ where: { providerId: p.id, status: 'DONE', day: { gte: iso(29) } }, select: { day: true, estimate: true } });
    const sum = (from: string) => rows.filter((r) => r.day >= from).reduce((a, r) => a + r.estimate, 0);
    const daily = Array.from({ length: 14 }, (_, i) => {
      const day = iso(13 - i);
      const list = rows.filter((r) => r.day === day);
      return { day, jobs: list.length, amount: list.reduce((a, r) => a + r.estimate, 0) };
    });
    const [lifetime, upcoming] = await Promise.all([
      this.prisma.booking.aggregate({ _sum: { estimate: true }, _count: true, where: { providerId: p.id, status: 'DONE' } }),
      this.prisma.booking.count({ where: { providerId: p.id, status: { in: ['CONFIRMED', 'ON_THE_WAY', 'IN_PROGRESS'] } } }),
    ]);
    return { today: sum(iso(0)), week: sum(iso(6)), month: sum(iso(29)), lifetime: lifetime._sum.estimate ?? 0, jobs: lifetime._count, upcoming, daily };
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
    });
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
  @Get('me') me(@CurrentUser() u: AuthUser) { return this.svc.me(u.id); }
  @Patch('online') online(@CurrentUser() u: AuthUser, @Body() dto: OnlineDto) { return this.svc.setOnline(u.id, dto.online); }
  @Patch('location') location(@CurrentUser() u: AuthUser, @Body() dto: LocationDto) { return this.svc.setLocation(u.id, dto); }
  @Get('earnings') earnings(@CurrentUser() u: AuthUser) { return this.svc.earnings(u.id); }
  @Patch('profile') profile(@CurrentUser() u: AuthUser, @Body() dto: ProfileDto) { return this.svc.updateProfile(u.id, dto); }
  @Post('bookings/:id/release') release(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: ReleaseDto) { return this.svc.release(u.id, id, dto.reason); }
  @Get('requests') requests(@CurrentUser() u: AuthUser) { return this.svc.requests(u.id); }
  @Get('jobs') jobs(@CurrentUser() u: AuthUser) { return this.svc.jobs(u.id); }
  @Post('bookings/:id/accept') accept(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.accept(u.id, id); }
  @Post('bookings/:id/decline') decline(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.decline(u.id, id); }
}

@Module({ controllers: [ProController], providers: [ProService] })
export class ProModule {}
