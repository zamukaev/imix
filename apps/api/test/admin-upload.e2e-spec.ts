import 'dotenv/config';
import { readFile, rm } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

const PREFIX = 'e2e-upload-';
const PASSWORD = 'correct-horse-battery';
const ADMIN_EMAIL = `${PREFIX}admin@example.com`;
const SHOPPER_EMAIL = `${PREFIX}shopper@example.com`;

/**
 * A real, if tiny, PNG — a 1×1 transparent pixel. Multer sniffs the type from
 * the multipart part rather than the bytes, but a valid file keeps this spec
 * honest about what it is uploading.
 */
const PNG_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFBQIAX8jx0gAAAABJRU5ErkJggg==';

/** Where `LocalDiskStorage` writes when `UPLOAD_DIR` is not overridden. */
const UPLOAD_DIR = resolve(process.cwd(), process.env.UPLOAD_DIR ?? '../web/public/uploads');

// Needs the database for the admin account; the upload itself hits the local disk.
describe('POST /admin/upload', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let shopperToken: string;
  const written: string[] = [];

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    await app.init();
    prisma = app.get(PrismaService);

    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });

    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(201);
    await prisma.user.update({
      where: { id: registered.body.user.id },
      data: { role: 'ADMIN' },
    });
    const promoted = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: ADMIN_EMAIL, password: PASSWORD })
      .expect(200);
    adminToken = promoted.body.accessToken;

    const shopper = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: SHOPPER_EMAIL, password: PASSWORD })
      .expect(201);
    shopperToken = shopper.body.accessToken;
  });

  afterAll(async () => {
    for (const filename of written) {
      await rm(join(UPLOAD_DIR, filename), { force: true });
    }
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } });
    await app.close();
  });

  const upload = (token: string) =>
    request(app.getHttpServer())
      .post('/admin/upload')
      .set('authorization', `Bearer ${token}`);

  const pixel = () => Buffer.from(PNG_BASE64, 'base64');

  it('answers 401 without a token', async () => {
    await request(app.getHttpServer())
      .post('/admin/upload')
      .attach('file', pixel(), { filename: 'x.png', contentType: 'image/png' })
      .expect(401);
  });

  it('answers 403 for a signed-in shopper', async () => {
    await upload(shopperToken)
      .attach('file', pixel(), { filename: 'x.png', contentType: 'image/png' })
      .expect(403);
  });

  it('stores a PNG and answers with a path the storefront can serve', async () => {
    const response = await upload(adminToken)
      .attach('file', pixel(), { filename: 'pixel.png', contentType: 'image/png' })
      .expect(201);

    expect(response.body.url).toMatch(/^\/uploads\/[0-9a-f]{16}\.png$/);

    const filename = response.body.url.replace('/uploads/', '');
    written.push(filename);

    // The bytes really are on disk, and they are the bytes that were sent.
    expect(await readFile(join(UPLOAD_DIR, filename))).toEqual(pixel());
  });

  it('names the file after its contents, so the same image twice is one file', async () => {
    const first = await upload(adminToken)
      .attach('file', pixel(), { filename: 'one.png', contentType: 'image/png' })
      .expect(201);
    const second = await upload(adminToken)
      // A different name, the same bytes.
      .attach('file', pixel(), { filename: 'another.png', contentType: 'image/png' })
      .expect(201);

    expect(second.body.url).toBe(first.body.url);
    written.push(first.body.url.replace('/uploads/', ''));
  });

  it('takes the extension from the sniffed type, not from the filename', async () => {
    // The filename is the half of an upload an attacker writes.
    const response = await upload(adminToken)
      .attach('file', pixel(), { filename: 'payload.php', contentType: 'image/png' })
      .expect(201);

    expect(response.body.url).toMatch(/\.png$/);
    written.push(response.body.url.replace('/uploads/', ''));
  });

  it('rejects a type it does not serve', async () => {
    const response = await upload(adminToken)
      .attach('file', Buffer.from('<?php ?>'), {
        filename: 'x.php',
        contentType: 'application/x-httpd-php',
      })
      .expect(400);

    expect(response.body.message).toContain('Unsupported file type');
  });

  it('rejects a request with no file at all', async () => {
    await upload(adminToken).expect(400);
  });
});
