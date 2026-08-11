import type { NextResponse } from 'next/server';
import type { AuthResponse } from '@imix/types';

/** The cookie jar on an outgoing response, reached through a public type. */
type ResponseCookies = NextResponse['cookies'];

/**
 * Where the session lives.
 *
 * The API hands tokens back in a JSON body and sets no cookies of its own: it
 * runs on a different origin, so its cookies would need `SameSite=None; Secure`
 * and would not survive local development. The storefront owns the browser
 * session instead — these two cookies are set by its own route handlers under
 * `/api/auth`, and unlike `imix-currency` they are `httpOnly`: no component ever
 * needs to read a token, and script that cannot read it cannot leak it.
 */
export const ACCESS_COOKIE = 'imix-access';
export const REFRESH_COOKIE = 'imix-refresh';

/**
 * Both cookies outlive their tokens on purpose.
 *
 * An expired access token in a cookie is harmless — the API rejects it and the
 * refresh path replaces it. A cookie that expires *first* is worse: the session
 * would look absent while it is still perfectly valid.
 */
const ACCESS_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24;
const REFRESH_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Both cookies are sent on every path.
 *
 * Scoping the refresh token to `/api/auth` would be tighter, and it was the
 * first shape of this — but then a page navigation cannot renew a session, and
 * the storefront would show a shopper as signed out fifteen minutes into
 * browsing while their session was still perfectly good. The middleware renews
 * it on navigation instead, which needs the cookie on `/`. It is `httpOnly` and
 * `SameSite=Lax`, so the width costs nothing a script can reach.
 */
const REFRESH_COOKIE_PATH = '/';

const shared = {
  httpOnly: true,
  // `lax` rather than `strict`: the session has to survive following a link
  // into the shop from anywhere else.
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
} as const;

/** Writes a freshly issued pair onto the response. */
export function setAuthCookies(cookies: ResponseCookies, tokens: AuthResponse): void {
  cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...shared,
    path: '/',
    maxAge: ACCESS_COOKIE_MAX_AGE_SECONDS,
  });
  cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...shared,
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_COOKIE_MAX_AGE_SECONDS,
  });
}

/**
 * Ends the session. Both cookies are overwritten with an immediate expiry
 * rather than deleted, because a delete without the original `path` silently
 * misses the refresh cookie and leaves it behind.
 */
export function clearAuthCookies(cookies: ResponseCookies): void {
  cookies.set(ACCESS_COOKIE, '', { ...shared, path: '/', maxAge: 0 });
  cookies.set(REFRESH_COOKIE, '', { ...shared, path: REFRESH_COOKIE_PATH, maxAge: 0 });
}
