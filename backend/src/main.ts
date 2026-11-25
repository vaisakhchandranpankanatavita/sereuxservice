import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configure } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configure(app);
  app.enableShutdownHooks();
  // Behind a reverse proxy on the same machine, set HOST=127.0.0.1 so the port isn't reachable from outside.
  await app.listen(process.env.PORT ?? 4000, process.env.HOST ?? '::');
}
bootstrap();
