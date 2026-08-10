import createMiddleware from 'next-intl/middleware';
import { routing } from './i18n/routing';

export default createMiddleware(routing);

export const config = {
  // Everything except Next internals and anything with a file extension —
  // `/products/*.jpg` must be served, not routed.
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
