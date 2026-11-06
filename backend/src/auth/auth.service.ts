import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomBytes } from 'crypto';
import { PrismaService } from '../common/prisma.module';
import { MailerService } from '../common/mailer';
import { hashPassword, sha256, verifyPassword } from '../common/password';
import { ForgotPasswordDto, LoginDto, RegisterDto, ResetPasswordDto, UpdateProfileDto } from './auth.dto';

const REFRESH_DAYS = 30;
const RESET_MINUTES = 30;
type U = { id: string; name: string; email: string; phone: string; role: any };
const publicUser = (u: U) => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, role: u.role });

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService, private mailer: MailerService) {}

  private async issue(u: U) {
    const accessToken = await this.jwt.signAsync({ sub: u.id, email: u.email, role: u.role });
    const refreshToken = randomBytes(32).toString('hex');
    await this.prisma.refreshToken.create({
      data: { userId: u.id, tokenHash: sha256(refreshToken), expiresAt: new Date(Date.now() + REFRESH_DAYS * 864e5) },
    });
    return { user: publicUser(u), accessToken, refreshToken };
  }

  async register(dto: RegisterDto) {
    if (await this.prisma.user.findUnique({ where: { email: dto.email } })) {
      throw new ConflictException('An account with this email already exists.');
    }
    const user = await this.prisma.user.create({
      data: { name: dto.name, email: dto.email, phone: dto.phone, passwordHash: await hashPassword(dto.password) },
    });
    return this.issue(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !(await verifyPassword(dto.password, user.passwordHash))) {
      throw new UnauthorizedException('Email or password is incorrect.');
    }
    return this.issue(user);
  }

  async refresh(token?: string) {
    if (!token) throw new UnauthorizedException();
    const row = await this.prisma.refreshToken.findUnique({ where: { tokenHash: sha256(token) }, include: { user: true } });
    if (!row || row.expiresAt < new Date()) throw new UnauthorizedException();
    await this.prisma.refreshToken.delete({ where: { id: row.id } });
    return this.issue(row.user);
  }

  async logout(token?: string) {
    if (token) await this.prisma.refreshToken.deleteMany({ where: { tokenHash: sha256(token) } });
  }

  async updateProfile(id: string, dto: UpdateProfileDto) {
    return publicUser(await this.prisma.user.update({ where: { id }, data: { name: dto.name, phone: dto.phone } }));
  }

  async me(id: string) {
    const u = await this.prisma.user.findUnique({ where: { id } });
    if (!u) throw new UnauthorizedException();
    return publicUser(u);
  }

  /* Always succeeds from the caller's point of view, whether or not the email exists — never reveal
     which emails have accounts. The link itself is emailed (or, with no SMTP configured, logged by
     MailerService — see its comment). Outside production the token is also returned directly, so
     local dev and the smoke test can drive the full flow without reading server logs. */
  async forgotPassword(dto: ForgotPasswordDto, appUrl: string) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) return {};
    const token = randomBytes(32).toString('hex');
    await this.prisma.passwordResetToken.create({
      data: { userId: user.id, tokenHash: sha256(token), expiresAt: new Date(Date.now() + RESET_MINUTES * 60_000) },
    });
    const link = `${appUrl}/reset-password?token=${token}`;
    await this.mailer.send(user.email, 'Reset your Fixzy password',
      `Hi ${user.name},\n\nUse this link to reset your password. It expires in ${RESET_MINUTES} minutes:\n${link}\n\nIf you didn't ask for this, you can ignore this email.`);
    return process.env.NODE_ENV === 'production' ? {} : { token };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const row = await this.prisma.passwordResetToken.findUnique({ where: { tokenHash: sha256(dto.token) } });
    if (!row || row.usedAt || row.expiresAt < new Date()) throw new BadRequestException('This reset link is invalid or has expired.');
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: row.userId }, data: { passwordHash: await hashPassword(dto.password) } }),
      this.prisma.passwordResetToken.update({ where: { id: row.id }, data: { usedAt: new Date() } }),
      this.prisma.refreshToken.deleteMany({ where: { userId: row.userId } }), // force re-login everywhere
    ]);
  }
}
