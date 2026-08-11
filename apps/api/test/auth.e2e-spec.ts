import 'dotenv/config';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

type AuthBody = {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string | null;
    role: 'USER' | 'ADMIN';
    createdAt: string;
  };
};

/**
 * Accounts this spec creates. Every address starts with the same prefix so the
 * cleanup can find them without touching a real one.
 */
const FIXTURE_PREFIX = 'e2e-auth-';
const email = (suffix: string): string => `${FIXTURE_PREFIX}${suffix}@example.com`;

const PASSWORD = 'correct-horse-battery';

// Needs the database: `docker compose up -d db && pnpm --filter api db:seed`.
describe('auth endpoints', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    // Mirrors the pipe configured in main.ts so validation is exercised here too.
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({
      where: { email: { startsWith: FIXTURE_PREFIX } },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { email: { startsWith: FIXTURE_PREFIX } },
    });
    await app.close();
  });

  const register = async (
    address: string,
    body: Record<string, unknown> = {},
  ): Promise<AuthBody> => {
    const response = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: address, password: PASSWORD, ...body })
      .expect(201);

    return response.body;
  };

  describe('POST /auth/register', () => {
    it('creates a shopper account and returns both tokens', async () => {
      const body = await register(email('new'), { name: '  Мила  ' });

      expect(body.accessToken).toEqual(expect.any(String));
      expect(body.refreshToken).toEqual(expect.any(String));
      expect(body.user).toEqual({
        id: expect.any(String),
        email: email('new'),
        // Trimmed by the DTO on the way in.
        name: 'Мила',
        role: 'USER',
        createdAt: expect.any(String),
      });
    });

    it('never lets the password hash leave the server', async () => {
      const body = await register(email('no-leak'));

      expect(JSON.stringify(body)).not.toContain('$argon2');
      expect(body.user).not.toHaveProperty('passwordHash');
    });

    it('cannot be used to mint an admin', async () => {
      // The DTO has no `role`, and `forbidNonWhitelisted` turns an uninvited
      // property into a 400 rather than quietly dropping it. Registration
      // creating a USER is asserted above; the first ADMIN comes from the seed.
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          email: email('self-promoted'),
          password: PASSWORD,
          role: 'ADMIN',
        })
        .expect(400);
    });

    it('normalises the address, so one person cannot hold two accounts', async () => {
      const body = await register(` ${email('CASED').toUpperCase()} `);

      expect(body.user.email).toBe(email('cased'));
    });

    it('refuses a second account on the same address with 409', async () => {
      await register(email('duplicate'));

      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: email('duplicate'), password: PASSWORD })
        .expect(409);
    });

    it('refuses a password shorter than the minimum with 400', async () => {
      await request(app.getHttpServer())
        .post('/auth/register')
        .send({ email: email('short'), password: 'short' })
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    const address = email('login');

    beforeAll(async () => {
      await register(address);
    });

    it('returns a fresh pair of tokens', async () => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: address, password: PASSWORD })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.user.email).toBe(address);
    });

    it.each([
      ['a wrong password', { password: 'not-the-password' }],
      ['an address nobody registered', { email: email('ghost') }],
    ])('answers 401 for %s', async (_label, override) => {
      const response = await request(app.getHttpServer())
        .post('/auth/login')
        .send({ email: address, password: PASSWORD, ...override })
        .expect(401);

      // The same message either way: a login form that distinguishes the two is
      // a way to ask which addresses have signed up here.
      expect(response.body.message).toBe('Invalid email or password.');
    });
  });

  describe('GET /auth/me', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/auth/me').expect(401);
    });

    it('answers 401 for a token that is not one of ours', async () => {
      await request(app.getHttpServer())
        .get('/auth/me')
        .set('authorization', 'Bearer not.a.token')
        .expect(401);
    });

    it('returns the current user behind a valid token', async () => {
      const { accessToken, user } = await register(email('me'));

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual(user);
    });

    it('reads the database rather than the token', async () => {
      const { accessToken, user } = await register(email('renamed'));

      await prisma.user.update({
        where: { id: user.id },
        data: { name: 'Renamed' },
      });

      const response = await request(app.getHttpServer())
        .get('/auth/me')
        .set('authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body.name).toBe('Renamed');
    });
  });

  describe('POST /auth/refresh', () => {
    it('trades a refresh token for a new pair', async () => {
      const { refreshToken } = await register(email('refresh'));

      const response = await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.accessToken).toEqual(expect.any(String));
      expect(response.body.refreshToken).toEqual(expect.any(String));
      expect(response.body.user.email).toBe(email('refresh'));
    });

    it('refuses an access token in place of a refresh token', async () => {
      const { accessToken } = await register(email('wrong-token'));

      // The two are signed with different secrets precisely so this fails.
      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken: accessToken })
        .expect(401);
    });

    it('refuses a refresh token for an account that no longer exists', async () => {
      const { refreshToken, user } = await register(email('deleted'));

      await prisma.user.delete({ where: { id: user.id } });

      await request(app.getHttpServer())
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });

  describe('GET /orders/me', () => {
    it('answers 401 without a token', async () => {
      await request(app.getHttpServer()).get('/orders/me').expect(401);
    });

    it('starts empty for a new account', async () => {
      const { accessToken } = await register(email('orders'));

      const response = await request(app.getHttpServer())
        .get('/orders/me')
        .set('authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body).toEqual([]);
    });
  });
});
