import { Global, Injectable, Logger, Module } from '@nestjs/common';
import { PrismaService } from './prisma.module';

const EXPO_PUSH = 'https://exp.host/--/api/v2/push/send';

/* Push notifications through Expo's push service. Best-effort by design: a failed push must never
   fail the request that triggered it, and with no registered device it is a silent no-op.
   Calls are awaited (not fire-and-forget) because serverless hosts freeze after the response. */
@Injectable()
export class PushService {
  private readonly log = new Logger('Push');
  constructor(private prisma: PrismaService) {}

  async register(userId: string, token: string, platform: string) {
    await this.prisma.pushToken.upsert({ where: { token }, create: { token, userId, platform }, update: { userId, platform } });
  }

  async unregister(userId: string, token: string) {
    await this.prisma.pushToken.deleteMany({ where: { token, userId } });
  }

  /* Push only (the caller already stored the in-app notification). */
  async send(userId: string, body: string, title = 'Fixzy', data: Record<string, unknown> = {}) {
    try {
      const rows = await this.prisma.pushToken.findMany({ where: { userId }, select: { token: true } });
      if (!rows.length) return;
      const res = await fetch(EXPO_PUSH, {
        method: 'POST',
        headers: { 'content-type': 'application/json', accept: 'application/json' },
        body: JSON.stringify(rows.map((r) => ({ to: r.token, title, body, sound: 'default', data }))),
      });
      const json: any = await res.json().catch(() => null);
      // Drop tokens Expo reports as dead so we stop pushing to uninstalled apps.
      const dead = (json?.data ?? []).flatMap((t: any, i: number) => (t?.details?.error === 'DeviceNotRegistered' ? [rows[i].token] : []));
      if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    } catch (e) {
      this.log.warn(`push failed for ${userId}: ${e}`);
    }
  }

  /* In-app notification plus push, for events that have no transaction of their own to piggyback on. */
  async alert(userId: string, text: string, title = 'Fixzy', href = '/jobs') {
    try { await this.prisma.notification.create({ data: { userId, text, href } }); } catch (e) { this.log.warn(`notify failed: ${e}`); }
    await this.send(userId, text, title, { href });
  }
}

@Global()
@Module({ providers: [PushService], exports: [PushService] })
export class PushModule {}
