import type { NextRequest, NextResponse } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { refreshTokens } from '@/lib/api';
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  clearAuthCookies,
  setAuthCookies,
} from '@/lib/auth-cookies';
import { readSessionClaims } from '@/lib/jwt-claims';
import { routing } from './i18n/routing';

const handleLocale = createMiddleware(routing);

/**
 * Two jobs, in this order: put the request on the right locale, then keep the
 * session alive.
 *
 * Renewing here rather than in a layout is not a preference — a Server
 * Component cannot set a cookie. Without this, an access token would age out
 * after fifteen minutes and the header would show a signed-in shopper as
 * signed out while their session was still perfectly good.
 *
 * The role gate for `/admin` slots in next to this in Phase 3.2. It belongs
 * here for the redirect only: the API enforces the role on every request of its
 * own (ARCHITECTURE.md §4).
 */
export default async function middleware(request: NextRequest): Promise<NextResponse> {
  // Renewed before the locale handler builds the response, and written back
  // onto the *request* as well as the response: that way the page being
  // rendered right now already sees the new token, instead of one render still
  // believing the shopper is signed out.
  const renewed = await slideSession(request);
  const response = handleLocale(request);

  renewed?.(response);

  return response;
}

/**
 * Trades an expired access token for a fresh pair, once, on the way through.
 * Returns the change still to be written onto the outgoing response, if any.
 *
 * Costs an API call only when the access token has actually aged out. A shopper
 * with no session, or one whose token is still good, pays nothing.
 */
async function slideSession(
  request: NextRequest,
): Promise<((response: NextResponse) => void) | null> {
  if (readSessionClaims(request.cookies.get(ACCESS_COOKIE)?.value)) {
    return null;
  }

  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return null;
  }

  try {
    const tokens = await refreshTokens(refreshToken);

    request.cookies.set(ACCESS_COOKIE, tokens.accessToken);

    return (response) => setAuthCookies(response.cookies, tokens);
  } catch {
    // Spent, forged, or the API is down. Either way this browser has nothing
    // usable left — clearing it stops every later request retrying with it.
    request.cookies.delete(ACCESS_COOKIE);

    return (response) => clearAuthCookies(response.cookies);
  }
}

export const config = {
  matcher: '/((?!api|_next|_vercel|.*\\..*).*)',
};
