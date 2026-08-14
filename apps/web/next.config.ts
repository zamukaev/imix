import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin('./src/i18n/request.ts');

const nextConfig: NextConfig = {
  typedRoutes: true,
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
