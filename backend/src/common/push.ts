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

  /* In-app notification plus push for many users at once (an admin broadcast). `userIds` null means
     every user with a registered token. Expo caps a single request at 100 messages, so this chunks. */
  async broadcast(userIds: string[] | null, text: string, title = 'Fixzy', href = '/') {
    try {
      if (userIds) await this.prisma.notification.createMany({ data: userIds.map((userId) => ({ userId, text, href })) });
      else {
        const all = await this.prisma.user.findMany({ select: { id: true } });
        await this.prisma.notification.createMany({ data: all.map((u) => ({ userId: u.id, text, href })) });
      }
    } catch (e) { this.log.warn(`broadcast notify failed: ${e}`); }

    const rows = await this.prisma.pushToken.findMany({ where: userIds ? { userId: { in: userIds } } : {}, select: { token: true } });
    if (!rows.length) return { sent: 0 };
    const dead: string[] = [];
    for (let i = 0; i < rows.length; i += 100) {
      const chunk = rows.slice(i, i + 100);
      try {
        const res = await fetch(EXPO_PUSH, {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify(chunk.map((r) => ({ to: r.token, title, body: text, sound: 'default', data: { href } }))),
        });
        const json: any = await res.json().catch(() => null);
        (json?.data ?? []).forEach((t: any, k: number) => { if (t?.details?.error === 'DeviceNotRegistered') dead.push(chunk[k].token); });
      } catch (e) { this.log.warn(`broadcast push chunk failed: ${e}`); }
    }
    if (dead.length) await this.prisma.pushToken.deleteMany({ where: { token: { in: dead } } });
    return { sent: rows.length - dead.length };
  }
}

@Global()
@Module({ providers: [PushService], exports: [PushService] })
export class PushModule {}
