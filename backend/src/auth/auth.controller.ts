import { Body, Controller, Get, HttpCode, Post, Req, Res, UseGuards } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto, RegisterDto } from './auth.dto';
import { AuthUser, CurrentUser, JwtAuthGuard } from '../common/auth';

const COOKIE = 'fixzy_rt';
const setCookie = (res: Response, token: string) =>
  res.cookie(COOKIE, token, { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/api/auth', maxAge: 30 * 864e5 });

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService) {}

  @Post('register') @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...out } = await this.auth.register(dto);
    setCookie(res, refreshToken);
    return out;
  }

  @Post('login') @HttpCode(200) @Throttle({ default: { limit: 10, ttl: 60_000 } })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...out } = await this.auth.login(dto);
    setCookie(res, refreshToken);
    return out;
  }

  @Post('refresh') @HttpCode(200)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const { refreshToken, ...out } = await this.auth.refresh(req.cookies?.[COOKIE]);
    setCookie(res, refreshToken);
    return out;
  }

  @Post('logout') @HttpCode(204)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.cookies?.[COOKIE]);
    res.clearCookie(COOKIE, { path: '/api/auth' });
  }

  @Get('me') @UseGuards(JwtAuthGuard)
  me(@CurrentUser() u: AuthUser) { return this.auth.me(u.id); }
}
