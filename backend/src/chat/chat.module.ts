import { Body, Controller, ForbiddenException, Get, Injectable, Module, NotFoundException, Param, Post, Query, UseGuards } from '@nestjs/common';
import { IsString, MaxLength, MinLength } from 'class-validator';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { PushService } from '../common/push';

class SendDto { @IsString() @MinLength(1) @MaxLength(1000) text: string; }

@Injectable()
class ChatService {
  constructor(private prisma: PrismaService, private push: PushService) {}

  /* Only the booking's customer, its assigned pro, or an admin may read the thread. */
  private async access(user: AuthUser, bookingId: string) {
    const b = await this.prisma.booking.findUnique({ where: { id: bookingId }, include: { provider: { select: { userId: true, name: true } }, service: { select: { name: true } } } });
    if (!b) throw new NotFoundException();
    const isCustomer = b.userId === user.id;
    const isPro = !!b.provider?.userId && b.provider.userId === user.id;
    if (!isCustomer && !isPro && user.role !== 'ADMIN') throw new NotFoundException();
    return { b, isCustomer, isPro };
  }

  async list(user: AuthUser, bookingId: string, after?: string) {
    await this.access(user, bookingId);
    const since = after ? new Date(after) : null;
    return this.prisma.chatMessage.findMany({
      where: { bookingId, ...(since && !Number.isNaN(since.getTime()) ? { createdAt: { gt: since } } : {}) },
      orderBy: { createdAt: 'asc' },
      take: 200,
      select: { id: true, senderId: true, text: true, createdAt: true },
    });
  }

  async send(user: AuthUser, bookingId: string, text: string) {
    const { b, isCustomer, isPro } = await this.access(user, bookingId);
    if (!isCustomer && !isPro) throw new ForbiddenException('Only the customer or the assigned pro can send messages.');
    if (!b.providerId || !b.provider?.userId) throw new ForbiddenException('Chat opens once a pro is assigned.');
    if (b.status === 'CANCELLED' || b.status === 'DONE') throw new ForbiddenException('This booking is closed.');
    const msg = await this.prisma.chatMessage.create({ data: { bookingId, senderId: user.id, text: text.trim() }, select: { id: true, senderId: true, text: true, createdAt: true } });
    const to = isCustomer ? b.provider.userId : b.userId;
    const preview = msg.text.length > 80 ? msg.text.slice(0, 77) + '…' : msg.text;
    await this.push.send(to, preview, isCustomer ? `${b.name} · ${b.service.name}` : b.provider.name, { href: isCustomer ? `/job/${bookingId}` : `/booking/${bookingId}` }).catch(() => {});
    return msg;
  }
}

@Controller('bookings/:id/messages')
@UseGuards(JwtAuthGuard)
class ChatController {
  constructor(private svc: ChatService) {}
  @Get() list(@CurrentUser() u: AuthUser, @Param('id') id: string, @Query('after') after?: string) { return this.svc.list(u, id, after); }
  @Post() send(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: SendDto) { return this.svc.send(u, id, dto.text); }
}

@Module({ controllers: [ChatController], providers: [ChatService] })
export class ChatModule {}
