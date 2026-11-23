import { BadRequestException, Body, ConflictException, Controller, Delete, Get, HttpCode, Module, NotFoundException, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { IsBoolean, IsEmail, IsIn, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from 'class-validator';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { PushService } from '../common/push';

class ReviewDto {
  @IsIn(['service', 'product']) kind: 'service' | 'product';
  @IsInt() target: number;
  @IsOptional() @IsString() bookingId?: string;
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(1000) text?: string;
}

class EditReviewDto {
  @IsInt() @Min(1) @Max(5) rating: number;
  @IsOptional() @IsString() @MaxLength(1000) text?: string;
}

class NotificationSettingsDto { @IsBoolean() push: boolean; }

class PushTokenDto {
  @IsString() @MinLength(10) @MaxLength(200) token: string;
  @IsOptional() @IsString() @MaxLength(20) platform?: string;
}

class ContactDto {
  @IsString() @MinLength(2) @MaxLength(80) name: string;
  @IsEmail() email: string;
  @IsString() @MinLength(10) @MaxLength(2000) message: string;
}

@Controller()
class AccountController {
  constructor(private prisma: PrismaService, private push: PushService) {}

  @Put('push-token') @HttpCode(204) @UseGuards(JwtAuthGuard)
  async registerPush(@CurrentUser() u: AuthUser, @Body() dto: PushTokenDto) {
    await this.push.register(u.id, dto.token, dto.platform ?? '');
  }

  @Get('notification-settings') @UseGuards(JwtAuthGuard)
  async notificationSettings(@CurrentUser() u: AuthUser) {
    const me = await this.prisma.user.findUnique({ where: { id: u.id }, select: { pushEnabled: true } });
    return { push: me?.pushEnabled ?? true };
  }

  @Put('notification-settings') @UseGuards(JwtAuthGuard)
  async setNotificationSettings(@CurrentUser() u: AuthUser, @Body() dto: NotificationSettingsDto) {
    await this.prisma.user.update({ where: { id: u.id }, data: { pushEnabled: dto.push } });
    return { push: dto.push };
  }

  @Delete('push-token') @HttpCode(204) @UseGuards(JwtAuthGuard)
  async unregisterPush(@CurrentUser() u: AuthUser, @Body() dto: PushTokenDto) {
    await this.push.unregister(u.id, dto.token);
  }

  @Get('notifications') @UseGuards(JwtAuthGuard)
  notifications(@CurrentUser() u: AuthUser) {
    return this.prisma.notification.findMany({ where: { userId: u.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  }

  @Post('notifications/read-all') @HttpCode(204) @UseGuards(JwtAuthGuard)
  async readAll(@CurrentUser() u: AuthUser) {
    await this.prisma.notification.updateMany({ where: { userId: u.id, read: false }, data: { read: true } });
  }

  @Get('wishlist') @UseGuards(JwtAuthGuard)
  async wishlist(@CurrentUser() u: AuthUser) {
    const rows = await this.prisma.wishlistItem.findMany({ where: { userId: u.id }, include: { product: true } });
    return rows.map((r) => r.product);
  }

  @Put('wishlist/:productId') @HttpCode(204) @UseGuards(JwtAuthGuard)
  async addWish(@CurrentUser() u: AuthUser, @Param('productId', ParseIntPipe) productId: number) {
    if (!(await this.prisma.product.findUnique({ where: { id: productId } }))) throw new BadRequestException('Unknown product.');
    await this.prisma.wishlistItem.upsert({ where: { userId_productId: { userId: u.id, productId } }, create: { userId: u.id, productId }, update: {} });
  }

  @Delete('wishlist/:productId') @HttpCode(204) @UseGuards(JwtAuthGuard)
  async removeWish(@CurrentUser() u: AuthUser, @Param('productId', ParseIntPipe) productId: number) {
    await this.prisma.wishlistItem.deleteMany({ where: { userId: u.id, productId } });
  }

  @Get('reviews')
  reviews(@Query('kind') kind: string, @Query('target', ParseIntPipe) target: number, @Query('skip') skip?: string) {
    return this.prisma.review.findMany({
      where: { kind, target, hidden: false }, orderBy: { createdAt: 'desc' }, take: 50, skip: Math.max(0, Number(skip) || 0),
      select: { id: true, rating: true, text: true, createdAt: true, reply: true, user: { select: { name: true } } },
    });
  }

  /* Customers can fix their own review; the pro's reply stays. */
  @Patch('reviews/:id') @UseGuards(JwtAuthGuard)
  async editReview(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: EditReviewDto) {
    const r = await this.prisma.review.findFirst({ where: { id, userId: u.id } });
    if (!r) throw new NotFoundException('Review not found.');
    return this.prisma.review.update({ where: { id }, data: { rating: dto.rating, text: dto.text?.trim() ?? '' } });
  }

  @Post('reviews') @UseGuards(JwtAuthGuard)
  async addReview(@CurrentUser() u: AuthUser, @Body() dto: ReviewDto) {
    if (dto.kind === 'service') {
      if (!dto.bookingId) throw new BadRequestException('A completed booking is required.');
      const b = await this.prisma.booking.findFirst({ where: { id: dto.bookingId, userId: u.id, serviceId: dto.target, status: 'DONE' } });
      if (!b) throw new BadRequestException('You can only review a completed booking.');
      if (await this.prisma.review.findUnique({ where: { bookingId: b.id } })) throw new ConflictException('You already reviewed this booking.');
    } else {
      const bought = await this.prisma.orderItem.findFirst({ where: { productId: dto.target, order: { userId: u.id, status: 'DELIVERED' } } });
      if (!bought) throw new BadRequestException('You can review a product once it has been delivered.');
      if (await this.prisma.review.findFirst({ where: { userId: u.id, kind: 'product', target: dto.target } })) throw new ConflictException('You already reviewed this product.');
    }
    const review = await this.prisma.review.create({
      data: { userId: u.id, kind: dto.kind, target: dto.target, bookingId: dto.bookingId ?? null, rating: dto.rating, text: dto.text?.trim() ?? '' },
    });
    if (dto.kind === 'service' && dto.bookingId) {
      const b = await this.prisma.booking.findUnique({ where: { id: dto.bookingId }, include: { provider: { select: { userId: true } } } });
      if (b?.provider?.userId) {
        const text = `New ${dto.rating}-star review from ${b.name.split(' ')[0]}.`;
        await this.prisma.notification.create({ data: { userId: b.provider.userId, text, href: '/reviews' } }).catch(() => {});
        await this.push.send(b.provider.userId, text, 'Fixzy Pro', { href: '/reviews' }).catch(() => {});
      }
    }
    return review;
  }

  @Post('contact') @HttpCode(201) @Throttle({ default: { limit: 5, ttl: 60_000 } })
  async contact(@Body() dto: ContactDto) {
    await this.prisma.contactMessage.create({ data: dto });
    return { ok: true };
  }
}

@Module({ controllers: [AccountController] })
export class AccountModule {}
