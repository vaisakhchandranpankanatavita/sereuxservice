import { INestApplication, ValidationPipe } from '@nestjs/common';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';

/* Shared by the long-running server (main.ts) and the Vercel serverless entry (serverless.ts). */
export function configure(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({ origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));

  /* Off by default: trusting a proxy you don't actually have lets a client spoof X-Forwarded-For and
     dodge the per-IP throttler entirely. Set TRUST_PROXY (e.g. "1" for one hop, or an IP/CIDR — see
     the Express docs for `trust proxy`) when this runs behind nginx, a load balancer, etc. */
  if (process.env.TRUST_PROXY) app.getHttpAdapter().getInstance().set('trust proxy', process.env.TRUST_PROXY);
}
