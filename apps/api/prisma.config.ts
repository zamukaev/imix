import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 no longer reads the connection URL from schema.prisma.
 * Migration and introspection commands take it from here; the runtime client
 * gets it through the pg driver adapter in src/prisma/prisma.service.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
    seed: 'ts-node prisma/seed.ts',
  },
  datasource: {
    url: env('DATABASE_URL'),
  },
});
