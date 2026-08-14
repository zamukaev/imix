import { NextResponse, type NextRequest } from 'next/server';
import createMiddleware from 'next-intl/middleware';
import { refreshTokens } from '@/lib/api';
import {
  LOGIN_PATH,
  RETURN_TO_PARAM,
  isAccountPath,
  isAdminPath,
  splitLocale,
} from '@/lib/session-routes';
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
 * Three jobs, in this order: renew the session, decide whether the visitor may
 * see `/admin` at all, then put the request on the right locale.
 *
 * Renewing first is not a preference — a Server Component cannot set a cookie,
 * so there is nowhere else to do it, and an admin whose access token aged out
 * mid-session would otherwise be bounced to the login form holding a perfectly
 * good session. It also means the gate below judges the *renewed* token.
 *
 * The gate is about which page somebody sees, and nothing more. The API guards
 * `/admin/*` with its own role check on every request (ARCHITECTURE.md §4) —
 * getting past this one buys an empty shell whose every fetch answers 403.
 */
export default async function middleware(request: NextRequest): Promise<NextResponse> {
  // Written back onto the *request* as well as the response, so the page being
  // rendered right now already sees the new token instead of one render still
  // believing the visitor is signed out.
  const renewed = await slideSession(request);
  const response = guardPrivate(request) ?? handleLocale(request);

  // Applied last, and to whichever response won: a redirect that dropped the
  // freshly issued cookies would send the visitor back round the same loop.
  renewed?.(response);

  return response;
}

/**
 * Keeps everyone but an admin out of `/admin`, and everyone signed out of
 * `/account`.
 *
 * Two gates, one shape: each names what it needs of the session, and a request
 * that satisfies it passes through untouched.
 *
 * The two refusals are different on purpose. Nobody signed in is sent to the
 * login form with a way back; somebody signed in as a shopper is sent home,
 * because asking them to sign in again would be a loop — they are already who
 * they are, and it is not enough. That second case cannot arise on `/account`,
 * where being signed in *is* the requirement.
 */
function guardPrivate(request: NextRequest): NextResponse | null {
  const { pathname } = request.nextUrl;
  const claims = readSessionClaims(request.cookies.get(ACCESS_COOKIE)?.value);

  const admitted = isAdminPath(pathname)
    ? claims?.role === 'ADMIN'
    : isAccountPath(pathname)
      ? Boolean(claims)
      : // A public page: nothing to decide.
        true;

  if (admitted) {
    return null;
  }

  const { prefix } = splitLocale(pathname);
  const destination = new URL(claims ? prefix || '/' : `${prefix}${LOGIN_PATH}`, request.url);

  if (!claims) {
    destination.searchParams.set(
      RETURN_TO_PARAM,
      `${pathname}${request.nextUrl.search}`,
    );
  }

  return NextResponse.redirect(destination);
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
