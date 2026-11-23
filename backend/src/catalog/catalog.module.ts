import { Controller, Get, Module, NotFoundException, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import type { Response } from 'express';
import { PrismaService } from '../common/prisma.module';
import { ConfigService } from '../config/config.module';

@Controller()
class CatalogController {
  constructor(private prisma: PrismaService, private config: ConfigService) {}

  /* Home-screen ads. Only banners whose coupon (if any) is still active are shown, with the discount so the app can label them. */
  @Get('banners')
  async banners() {
    const rows = await this.prisma.banner.findMany({ where: { active: true }, orderBy: [{ sort: 'asc' }, { id: 'desc' }] });
    const codes = rows.map((b) => b.coupon).filter((c): c is string => !!c);
    const coupons = codes.length ? await this.prisma.coupon.findMany({ where: { code: { in: codes }, active: true } }) : [];
    return rows
      .filter((b) => !b.coupon || coupons.some((c) => c.code === b.coupon))
      .map((b) => ({ ...b, percent: coupons.find((c) => c.code === b.coupon)?.percent ?? null }));
  }

  @Get('services')
  async services(@Query('category') category?: string) {
    const rows = await this.prisma.service.findMany({ where: category ? { category } : undefined, orderBy: { id: 'asc' } });
    const ratings = await this.prisma.review.groupBy({ by: ['target'], where: { kind: 'service' }, _avg: { rating: true }, _count: true });
    return rows.map((s) => {
      const r = ratings.find((x) => x.target === s.id);
      return { ...s, rating: r?._avg.rating ?? null, reviews: r?._count ?? 0 };
    });
  }

  /* Admin-uploaded service art. The URL carries imageVersion, so it caches forever and busts on every change. */
  @Get('services/:id/image')
  async serviceImage(@Param('id', ParseIntPipe) id: number, @Res() res: Response) {
    const img = await this.prisma.serviceImage.findUnique({ where: { serviceId: id } });
    if (!img) throw new NotFoundException();
    res.setHeader('content-type', img.type);
    res.setHeader('cross-origin-resource-policy', 'cross-origin');
    res.setHeader('cache-control', 'public, max-age=31536000, immutable');
    res.send(Buffer.from(img.data));
  }

  @Get('services/:id')
  async service(@Param('id', ParseIntPipe) id: number) {
    const s = await this.prisma.service.findUnique({ where: { id }, include: { providers: true } });
    if (!s) throw new NotFoundException();
    return s;
  }

  @Get('services/:id/availability')
  async availability(@Param('id', ParseIntPipe) id: number, @Query('day') day: string, @Query('providerId') providerId?: string) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day ?? '')) return { day, slots: [] };
    const taken = await this.prisma.booking.findMany({
      where: { day, status: { not: 'CANCELLED' }, ...(providerId ? { providerId: Number(providerId) } : { serviceId: id }) },
      select: { slot: true },
    });
    const busy = new Set(taken.map((b) => b.slot));
    const slots = await this.config.get<string[]>('rules.bookingSlots');
    return { day, slots: slots.map((slot) => ({ slot, available: !busy.has(slot) })) };
  }

  @Get('providers')
  providers(@Query('serviceId') serviceId?: string) {
    return this.prisma.provider.findMany({
      where: serviceId ? { services: { some: { id: Number(serviceId) } } } : undefined,
      include: { services: { select: { id: true } } },
    });
  }

  @Get('products')
  products(@Query('category') category?: string) {
    return this.prisma.product.findMany({ where: category ? { category } : undefined, orderBy: { id: 'desc' } });
  }

  @Get('products/:id')
  async product(@Param('id', ParseIntPipe) id: number) {
    const p = await this.prisma.product.findUnique({ where: { id } });
    if (!p) throw new NotFoundException();
    return p;
  }
}

@Module({ controllers: [CatalogController] })
export class CatalogModule {}
