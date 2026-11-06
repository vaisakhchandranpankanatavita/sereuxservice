import { BadRequestException, Body, Controller, Headers, HttpCode, Injectable, Module, NotFoundException, Param, Post, RawBodyRequest, Req, UseGuards } from '@nestjs/common';
import { IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth';
import { RazorpayService } from './razorpay.service';

class VerifyDto {
  @IsString() @MinLength(1) razorpay_order_id: string;
  @IsString() @MinLength(1) razorpay_payment_id: string;
  @IsString() @MinLength(1) razorpay_signature: string;
}

@Injectable()
export class PaymentsService {
  constructor(private prisma: PrismaService, private razorpay: RazorpayService) {}

  /* Starts (or resumes) online payment for an order the customer placed with paymentMethod ONLINE. */
  async startOrderPayment(user: AuthUser, orderId: string) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id }, include: { payment: true } });
    if (!order) throw new NotFoundException();
    if (order.paymentMethod !== 'ONLINE') throw new BadRequestException('This order is pay on delivery.');
    if (order.payment?.status === 'PAID') throw new BadRequestException('This order is already paid.');
    if (order.status === 'CANCELLED') throw new BadRequestException('This order was cancelled.');

    if (order.payment && order.payment.status === 'CREATED') {
      return { keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: order.payment.providerOrderId, amount: order.payment.amount, currency: 'INR' };
    }
    const amount = order.total * 100; // rupees -> paise
    const rp = await this.razorpay.createOrder(amount, order.id);
    await this.prisma.payment.upsert({
      where: { orderId: order.id },
      create: { orderId: order.id, providerOrderId: rp.id, amount },
      update: { providerOrderId: rp.id, amount, status: 'CREATED', providerPaymentId: null },
    });
    return { keyId: process.env.RAZORPAY_KEY_ID, razorpayOrderId: rp.id, amount, currency: 'INR' };
  }

  /* Client-side confirmation right after Checkout succeeds. The webhook is the source of truth if this never arrives. */
  async verifyOrderPayment(user: AuthUser, orderId: string, dto: VerifyDto) {
    const order = await this.prisma.order.findFirst({ where: { id: orderId, userId: user.id }, include: { payment: true } });
    if (!order?.payment) throw new NotFoundException();
    if (order.payment.providerOrderId !== dto.razorpay_order_id) throw new BadRequestException('Payment does not match this order.');
    if (!this.razorpay.verifyCheckoutSignature(dto.razorpay_order_id, dto.razorpay_payment_id, dto.razorpay_signature)) {
      throw new BadRequestException('Payment could not be verified.');
    }
    if (order.payment.status !== 'PAID') {
      await this.prisma.payment.update({ where: { orderId: order.id }, data: { status: 'PAID', providerPaymentId: dto.razorpay_payment_id } });
    }
    return { paid: true };
  }

  /* Razorpay webhook: the durable path, since a client that closes mid-checkout never calls verify(). */
  async handleWebhook(rawBody: Buffer, signature: string | undefined) {
    if (!this.razorpay.verifyWebhookSignature(rawBody, signature)) throw new BadRequestException('Bad signature.');
    const event = JSON.parse(rawBody.toString('utf8'));
    const entity = event?.payload?.payment?.entity;
    if (!entity) return { ok: true };

    const payment = await this.prisma.payment.findFirst({ where: { providerOrderId: entity.order_id } });
    if (!payment) return { ok: true };

    if (event.event === 'payment.captured' && payment.status !== 'PAID') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'PAID', providerPaymentId: entity.id } });
    } else if (event.event === 'payment.failed' && payment.status === 'CREATED') {
      await this.prisma.payment.update({ where: { id: payment.id }, data: { status: 'FAILED' } });
    }
    return { ok: true };
  }

  /* Called by admin order cancellation; never throws. */
  async refundIfPaid(orderId: string) {
    const payment = await this.prisma.payment.findUnique({ where: { orderId } });
    if (!payment || payment.status !== 'PAID' || !payment.providerPaymentId) return;
    const refunded = await this.razorpay.refund(payment.providerPaymentId, payment.amount);
    if (refunded) await this.prisma.payment.update({ where: { orderId }, data: { status: 'REFUNDED' } });
  }
}

@Controller('payments')
class PaymentsController {
  constructor(private svc: PaymentsService) {}

  @Post('orders/:id') @UseGuards(JwtAuthGuard)
  start(@CurrentUser() u: AuthUser, @Param('id') id: string) { return this.svc.startOrderPayment(u, id); }

  @Post('orders/:id/verify') @UseGuards(JwtAuthGuard)
  verify(@CurrentUser() u: AuthUser, @Param('id') id: string, @Body() dto: VerifyDto) { return this.svc.verifyOrderPayment(u, id, dto); }

  /* Public: Razorpay calls this directly. Signed with RAZORPAY_WEBHOOK_SECRET, not a user token. */
  @Post('webhook') @HttpCode(200)
  webhook(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature?: string | string[]) {
    return this.svc.handleWebhook(req.rawBody ?? Buffer.from(JSON.stringify(req.body ?? {})), Array.isArray(signature) ? signature[0] : signature);
  }
}

@Module({ controllers: [PaymentsController], providers: [PaymentsService, RazorpayService], exports: [PaymentsService, RazorpayService] })
export class PaymentsModule {}
