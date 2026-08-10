import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';

/**
 * Covers the parts of the payment endpoints that do not need Stripe: input
 * validation, order lookup, and the refusal to act on an unsigned webhook.
 *
 * Anything past those gates talks to Stripe and belongs in a manual run against
 * the CLI (`stripe listen --forward-to localhost:4000/payments/webhook`).
 */
describe('payments endpoints', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    // `rawBody` mirrors main.ts — the webhook route reads the untouched bytes.
    app = moduleRef.createNestApplication({ rawBody: true });
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /payments/intent', () => {
    it('404s for an order that does not exist', async () => {
      // The order is looked up before Stripe is touched, so this holds whether
      // or not the environment has keys configured.
      await request(app.getHttpServer())
        .post('/payments/intent')
        .send({ orderId: 'z'.repeat(25) })
        .expect(404);
    });

    it.each([
      ['a missing orderId', {}],
      ['a malformed orderId', { orderId: 'nope' }],
      ['an unknown property', { orderId: 'z'.repeat(25), amount: 1 }],
    ])('rejects %s with 400', async (_label, body) => {
      await request(app.getHttpServer())
        .post('/payments/intent')
        .send(body)
        .expect(400);
    });
  });

  describe('POST /payments/webhook', () => {
    it('rejects a payload without a signature header', async () => {
      await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Content-Type', 'application/json')
        .send({ type: 'payment_intent.succeeded' })
        .expect(400);
    });

    it('rejects a payload whose signature does not verify', async () => {
      const response = await request(app.getHttpServer())
        .post('/payments/webhook')
        .set('Content-Type', 'application/json')
        .set('stripe-signature', 't=1,v1=deadbeef')
        .send({ type: 'payment_intent.succeeded' });

      // 400 when a webhook secret is configured, 503 when the server has none —
      // either way the event is never applied.
      expect([400, 503]).toContain(response.status);
    });
  });
});
