import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';

const DEFAULT_PORT = 4000;
const DEFAULT_WEB_ORIGIN = 'http://localhost:3000';

/**
 * Every interface, not just loopback.
 *
 * Node binds to all of them by default, so this is a no-op locally — but in a
 * container "the default" is the one thing that must not be left to change: a
 * server on 127.0.0.1 is unreachable from the sibling container that proxies to
 * it, and the symptom is a health check timing out with nothing in the log.
 */
const LISTEN_HOST = '0.0.0.0';

/**
 * One proxy sits in front of this server (nginx), so exactly one hop of
 * `X-Forwarded-For` is trustworthy. Without this Express reports nginx's own
 * address as the client's for every request; trusting the whole chain instead
 * would let a caller name any address they like.
 */
const TRUSTED_PROXY_HOPS = 1;

async function bootstrap(): Promise<void> {
  // `rawBody` keeps the untouched request bytes around: Stripe signs those, and
  // the webhook signature cannot be verified against re-serialised JSON.
  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
  });

  app.set('trust proxy', TRUSTED_PROXY_HOPS);

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

  await app.listen(Number(process.env.PORT ?? DEFAULT_PORT), LISTEN_HOST);
}

void bootstrap();
