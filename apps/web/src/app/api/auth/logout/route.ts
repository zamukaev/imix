import { NextResponse } from 'next/server';
import { clearAuthCookies } from '@/lib/auth-cookies';

/**
 * Ends the session.
 *
 * Only the cookies go — the refresh token stays valid at the API until it
 * expires, because refresh tokens are stateless JWTs with no table to revoke
 * them in (see `auth.constants.ts` in the API). Signing out of this browser is
 * what the button promises, and that is what it does.
 *
 * POST rather than GET so a prefetch or an image tag cannot log anybody out.
 */
export function POST(): NextResponse {
  const response = new NextResponse(null, { status: 204 });

  clearAuthCookies(response.cookies);

  return response;
}
