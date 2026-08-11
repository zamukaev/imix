import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { refreshTokens } from '@/lib/api';
import { REFRESH_COOKIE, clearAuthCookies } from '@/lib/auth-cookies';
import { authResponse, type AuthRouteResult } from '@/lib/auth-route';

const UNAUTHORIZED = 401;

/**
 * Renews the session from the refresh cookie.
 *
 * The middleware does this on navigation, so a shopper clicking around never
 * reaches here. It exists for the case the middleware cannot cover: a client
 * island that finds its session has aged out between renders.
 */
export async function POST(): Promise<NextResponse<AuthRouteResult>> {
  const store = await cookies();
  const refreshToken = store.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return NextResponse.json<AuthRouteResult>(
      { message: 'No session to refresh.' },
      { status: UNAUTHORIZED },
    );
  }

  const response = await authResponse(() => refreshTokens(refreshToken));

  // A refusal here means the refresh token is spent or forged. Leaving it in
  // place would make every future request retry with it.
  if (!response.ok) {
    clearAuthCookies(response.cookies);
  }

  return response;
}
