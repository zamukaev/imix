import { ROLES, type Role } from '@imix/types';

/** The claims the storefront actually reads — not the whole token payload. */
export type SessionClaims = {
  sub: string;
  email: string;
  role: Role;
  /** Seconds since the epoch, set by the signer. */
  exp: number;
};

const MILLISECONDS_PER_SECOND = 1000;

/** `header.payload.signature` — the middle segment is the one worth reading. */
const JWT_SEGMENTS = 3;

/**
 * Decodes the claims of an access token, or `null` if there is nothing usable
 * there — expired counts as nothing usable.
 *
 * **The signature is not checked.** That is deliberate and it is the split
 * described in ARCHITECTURE.md §4: the API holds the signing secret and verifies
 * every request against it, so this side only decides which link the header
 * shows and which page redirects. Forging the cookie gets somebody a signed-in
 * looking page whose every request comes back 401. Verifying here would mean
 * giving the web app the API's secret, and the point of two deployables is that
 * only one of them holds it.
 *
 * Written without `Buffer` and without a JOSE dependency so the same function
 * runs in a Server Component and in the Edge middleware.
 */
export function readSessionClaims(token: string | undefined): SessionClaims | null {
  const claims = decode(token);

  if (!claims) {
    return null;
  }

  return claims.exp * MILLISECONDS_PER_SECOND > Date.now() ? claims : null;
}

function decode(token: string | undefined): SessionClaims | null {
  if (!token) {
    return null;
  }

  const segments = token.split('.');
  const payload = segments[1];

  if (segments.length !== JWT_SEGMENTS || !payload) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(fromBase64Url(payload));

    return isSessionClaims(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * base64url → text. `atob` only speaks base64 and hands back bytes, so the two
 * substitutions and the padding go in first and a `TextDecoder` turns the bytes
 * back into UTF-8 — a name with Cyrillic in it must survive the round trip.
 */
function fromBase64Url(value: string): string {
  const base64 = value.replaceAll('-', '+').replaceAll('_', '/');
  const binary = atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, '='));
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));

  return new TextDecoder().decode(bytes);
}

/**
 * The cookie is attacker-controlled, so every claim is checked rather than
 * assumed — a payload with no `role` has to read as "no session" instead of
 * letting `undefined` flow into a comparison further down.
 */
function isSessionClaims(value: unknown): value is SessionClaims {
  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const claims = value as Record<string, unknown>;

  return (
    typeof claims.sub === 'string' &&
    typeof claims.email === 'string' &&
    typeof claims.exp === 'number' &&
    ROLES.some((role) => role === claims.role)
  );
}
