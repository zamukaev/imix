import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

const DEFAULT_PORT = 4000;
const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

async function bootstrap(): Promise<void> {
  // `rawBody` keeps the untouched request bytes around: Stripe signs those, and
  // the webhook signature cannot be verified against re-serialised JSON.
  const app = await NestFactory.create(AppModule, { rawBody: true });

  // Client input is never trusted: unknown properties are rejected outright.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({
    origin: (process.env.WEB_ORIGIN ?? DEFAULT_WEB_ORIGIN)
      .split(',')
      .map((o) => o.trim()),
    credentials: true,
  });

  await app.listen(Number(process.env.PORT ?? DEFAULT_PORT));
}

void bootstrap();
