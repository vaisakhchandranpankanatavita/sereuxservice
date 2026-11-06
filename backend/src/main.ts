import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configure } from './setup';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });
  configure(app);
  app.enableShutdownHooks();
  await app.listen(process.env.PORT ?? 4000);
}
bootstrap();
