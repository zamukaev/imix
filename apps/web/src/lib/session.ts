import { cookies } from 'next/headers';
import type { Role } from '@imix/types';
import { ACCESS_COOKIE } from './auth-cookies';
import { readSessionClaims } from './jwt-claims';

/**
 * Who the storefront believes is browsing, read from the access token in the
 * cookie. See `readSessionClaims` for why the signature is not checked here and
 * why that is safe: the API is the one that decides, this only decides what the
 * page looks like.
 *
 * Server-only. Client components have no business reading a token — the cookie
 * is httpOnly precisely so they cannot.
 */
export type Session = {
  userId: string;
  email: string;
  role: Role;
};

export async function getSession(): Promise<Session | null> {
  const store = await cookies();
  const claims = readSessionClaims(store.get(ACCESS_COOKIE)?.value);

  if (!claims) {
    return null;
  }

  return { userId: claims.sub, email: claims.email, role: claims.role };
}
