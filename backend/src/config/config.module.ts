import { BadRequestException, Body, Controller, Delete, Get, Global, HttpCode, Injectable, Module, NotFoundException, Param, Put, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { IsDefined } from 'class-validator';
import { PrismaService } from '../common/prisma.module';
import { AuthUser, CurrentUser, JwtAuthGuard, Roles } from '../common/auth';

type SettingType = 'string' | 'number' | 'boolean' | 'color' | 'url' | 'stringList' | 'timeList' | 'qaList';
export type SettingDef = {
  key: string;
  group: 'content' | 'rules' | 'flags' | 'regions';
  type: SettingType;
  default: unknown;
  label: string;
  public: boolean;
  min?: number;
  max?: number;
};

/* Single source of truth for every admin-tunable value. Add a row here to expose a new setting. */
export const SETTINGS: SettingDef[] = [
  { key: 'content.faq', group: 'content', type: 'qaList', default: [
    { q: 'How do I reschedule a booking?', a: 'Open the booking from Activity and choose a new day and slot. You can move it until the pro is confirmed.' },
    { q: 'When do I pay for a service?', a: 'You see the price before you book. Pay once the job is done, using the method you picked at checkout.' },
    { q: 'Can I cancel an order or booking?', a: 'Bookings can be cancelled from their page while still open. Shop orders can be cancelled before they ship.' },
    { q: 'How are pros verified?', a: 'Every pro is identity-checked and reviewed before they can take jobs. Ratings from past customers are shown on each service.' },
  ], label: 'Help centre questions (FAQ)', public: true },
  { key: 'content.supportEmail', group: 'content', type: 'string', default: '', label: 'Support email', public: true },
  { key: 'content.supportPhone', group: 'content', type: 'string', default: '', label: 'Support phone', public: true },
  { key: 'content.termsUrl', group: 'content', type: 'url', default: '', label: 'Terms of service URL', public: true },
  { key: 'content.privacyUrl', group: 'content', type: 'url', default: '', label: 'Privacy policy URL', public: true },
  { key: 'content.customer.welcomeTitle', group: 'content', type: 'string', default: '', label: 'Customer welcome title (blank = app default)', public: true },
  { key: 'content.pro.welcomeTitle', group: 'content', type: 'string', default: '', label: 'Pro welcome title (blank = app default)', public: true },
  { key: 'rules.bookingSlots', group: 'rules', type: 'timeList', default: ['09:00', '11:00', '13:00', '15:00', '17:00'], label: 'Bookable time slots (24h HH:MM, one per line)', public: true },
  { key: 'rules.maxDaysAhead', group: 'rules', type: 'number', default: 60, min: 1, max: 365, label: 'How many days ahead customers can book', public: true },
  { key: 'rules.dispatchRadiusKm', group: 'rules', type: 'number', default: 0, min: 0, max: 500, label: 'Job dispatch radius in km (0 = unlimited)', public: true },
  { key: 'rules.minPayout', group: 'rules', type: 'number', default: 0, min: 0, max: 1_000_000, label: 'Minimum payout amount', public: true },
  { key: 'rules.defaultCommissionPercent', group: 'rules', type: 'number', default: 20, min: 0, max: 100, label: 'Default commission % for new providers', public: false },
  { key: 'rules.cancelFreeHours', group: 'rules', type: 'number', default: 24, min: 0, max: 720, label: 'Free cancellation until this many hours before the slot', public: true },
  { key: 'rules.cancelFeePercent', group: 'rules', type: 'number', default: 10, min: 0, max: 100, label: 'Late cancellation fee (% of the booking total)', public: true },
  { key: 'rules.kycRequired', group: 'rules', type: 'boolean', default: true, label: 'Require KYC before accepting jobs', public: true },
  { key: 'flags.maintenanceMode', group: 'flags', type: 'boolean', default: false, label: 'Maintenance mode (apps show a downtime screen)', public: true },
  { key: 'flags.maintenanceMessage', group: 'flags', type: 'string', default: '', label: 'Maintenance message', public: true },
  { key: 'flags.minAppVersion.customer', group: 'flags', type: 'string', default: '', label: 'Minimum customer app version (force update)', public: true },
  { key: 'flags.minAppVersion.pro', group: 'flags', type: 'string', default: '', label: 'Minimum pro app version (force update)', public: true },
  { key: 'flags.shopEnabled', group: 'flags', type: 'boolean', default: true, label: 'Show shop in customer app', public: true },
  { key: 'flags.chatEnabled', group: 'flags', type: 'boolean', default: true, label: 'Enable booking chat', public: true },
  { key: 'regions.cities', group: 'regions', type: 'stringList', default: [], label: 'Supported cities (empty = everywhere)', public: true },
];
const BY_KEY = new Map(SETTINGS.map((d) => [d.key, d]));

function coerce(def: SettingDef, v: unknown): unknown {
  const bad = (m: string) => new BadRequestException(`${def.key}: ${m}`);
  switch (def.type) {
    case 'boolean':
      if (typeof v !== 'boolean') throw bad('must be true or false');
      return v;
    case 'number':
      if (typeof v !== 'number' || !Number.isFinite(v)) throw bad('must be a number');
      if ((def.min != null && v < def.min) || (def.max != null && v > def.max)) throw bad(`must be between ${def.min} and ${def.max}`);
      return v;
    case 'color':
      if (typeof v !== 'string' || !/^#[0-9A-Fa-f]{6}$/.test(v)) throw bad('must be a #RRGGBB color');
      return v;
    case 'url':
      if (typeof v !== 'string' || v.length > 300 || (v !== '' && !/^https?:\/\//i.test(v))) throw bad('must be an http(s) URL or empty');
      return v;
    case 'timeList':
      if (!Array.isArray(v) || !v.length || v.length > 24 || v.some((x) => typeof x !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(x.trim()))) throw bad('must be 1-24 times like 09:00');
      return [...new Set((v as string[]).map((x) => x.trim()))].sort();
    case 'qaList':
      if (!Array.isArray(v) || v.length > 30 || v.some((x) => !x || typeof x.q !== 'string' || typeof x.a !== 'string' || !x.q.trim() || !x.a.trim() || x.q.length > 200 || x.a.length > 1000)) throw bad('must be up to 30 questions with answers');
      return v.map((x: { q: string; a: string }) => ({ q: x.q.trim(), a: x.a.trim() }));
    case 'stringList':
      if (!Array.isArray(v) || v.length > 200 || v.some((x) => typeof x !== 'string' || !x.trim() || x.length > 80)) throw bad('must be a list of short strings');
      return v.map((x: string) => x.trim());
    default:
      if (typeof v !== 'string' || v.length > 500) throw bad('must be text up to 500 chars');
      return v;
  }
}

@Injectable()
export class ConfigService {
  private cache: { at: number; values: Map<string, { value: unknown; updatedAt: Date }> } | null = null;
  constructor(private prisma: PrismaService) {}

  private async overrides() {
    if (this.cache && Date.now() - this.cache.at < 10_000) return this.cache.values;
    const rows = await this.prisma.appSetting.findMany();
    const values = new Map(rows.map((r) => [r.key, { value: r.value as unknown, updatedAt: r.updatedAt }]));
    this.cache = { at: Date.now(), values };
    return values;
  }

  async get<T = unknown>(key: string): Promise<T> {
    const def = BY_KEY.get(key);
    if (!def) throw new Error(`Unknown setting ${key}`);
    const o = (await this.overrides()).get(key);
    return (o ? o.value : def.default) as T;
  }

  async publicConfig() {
    const o = await this.overrides();
    const settings: Record<string, unknown> = {};
    let version = 0;
    for (const d of SETTINGS) {
      if (!d.public) continue;
      const row = o.get(d.key);
      settings[d.key] = row ? row.value : d.default;
      if (row) version = Math.max(version, row.updatedAt.getTime());
    }
    return { version, settings };
  }

  async adminList() {
    const o = await this.overrides();
    return SETTINGS.map((d) => {
      const row = o.get(d.key);
      return { ...d, value: row ? row.value : d.default, overridden: !!row, updatedAt: row?.updatedAt ?? null };
    });
  }

  async set(me: AuthUser, key: string, raw: unknown) {
    const def = BY_KEY.get(key);
    if (!def) throw new NotFoundException('Unknown setting');
    const value = coerce(def, raw);
    await this.prisma.appSetting.upsert({
      where: { key },
      create: { key, value: value as never, updatedBy: me.email },
      update: { value: value as never, updatedBy: me.email },
    });
    await this.prisma.auditLog.create({ data: { actorId: me.id, actorEmail: me.email, action: 'setting.update', target: key, meta: { value } as never } });
    this.cache = null;
    return { key, value };
  }

  async reset(me: AuthUser, key: string) {
    if (!BY_KEY.has(key)) throw new NotFoundException('Unknown setting');
    await this.prisma.appSetting.deleteMany({ where: { key } });
    await this.prisma.auditLog.create({ data: { actorId: me.id, actorEmail: me.email, action: 'setting.reset', target: key } });
    this.cache = null;
  }
}

class SettingBody { @IsDefined() value: unknown }

@Controller()
class ConfigController {
  constructor(private svc: ConfigService) {}

  @Get('config') publicConfig() { return this.svc.publicConfig(); }

  @Get('admin/settings') @UseGuards(JwtAuthGuard) @Roles(Role.ADMIN)
  list() { return this.svc.adminList(); }

  @Put('admin/settings/:key') @UseGuards(JwtAuthGuard) @Roles(Role.ADMIN)
  set(@CurrentUser() me: AuthUser, @Param('key') key: string, @Body() body: SettingBody) { return this.svc.set(me, key, body?.value); }

  @Delete('admin/settings/:key') @HttpCode(204) @UseGuards(JwtAuthGuard) @Roles(Role.ADMIN)
  reset(@CurrentUser() me: AuthUser, @Param('key') key: string) { return this.svc.reset(me, key); }
}

@Global()
@Module({ controllers: [ConfigController], providers: [ConfigService], exports: [ConfigService] })
export class AppConfigModule {}
