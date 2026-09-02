import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

/** This file's own directory — `__dirname` does not exist in an ES module. */
const here = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  typedRoutes: true,

  /**
   * Ships a self-contained server in `.next/standalone` with only the modules
   * the app actually reaches. The Docker image copies that instead of
   * reinstalling dependencies, which is the difference between a runtime layer
   * of a few hundred megabytes and one carrying the whole workspace.
   */
  output: 'standalone',

  /**
   * Trace from the repository root, not from `apps/web`.
   *
   * pnpm links workspace packages as symlinks into a store above the app, so a
   * trace rooted here would follow `@imix/types` out of its own root and drop
   * it. Next only warns about that — the failure shows up at runtime, as a
   * module that is not there.
   */
  outputFileTracingRoot: join(here, '../..'),

  images: {
    /**
     * Uploaded assets come back as absolute URLs when `CLOUDINARY_URL` is set,
     * and as `/uploads/…` on this origin when it is not. Only the first needs
     * declaring — an allowlist rather than a wildcard, because this list is what
     * stops the shop's own image optimiser being pointed at somebody else's
     * server.
     */
    remotePatterns: [{ protocol: 'https', hostname: 'res.cloudinary.com' }],
  },
};

export default withNextIntl(nextConfig);
