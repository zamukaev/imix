import { Logger } from '@nestjs/common';

/**
 * How long an access token stays valid. Short, because it carries the role and
 * is checked without a database round trip: a demoted admin keeps their powers
 * until this expires.
 */
export const ACCESS_TOKEN_TTL = '15m';

/**
 * How long a refresh token stays valid — the length of a "stay signed in".
 *
 * Refresh tokens are stateless JWTs rather than rows in a table, so there is no
 * way to revoke a single session before it expires. That is the deliberate MVP
 * trade: a session table would need cleanup, rotation and a second round trip on
 * every refresh. Rotating `JWT_REFRESH_SECRET` invalidates all of them at once,
 * which is the escape hatch until it is worth building the table.
 */
export const REFRESH_TOKEN_TTL = '30d';

/**
 * Only ever used outside production. Auth cannot degrade the way payments do —
 * a shop with no Stripe key still sells nothing but browses fine, whereas a shop
 * that signs tokens with nothing at all is worse than one that refuses to boot.
 * In production a missing secret throws; locally it would only stop every e2e
 * spec from booting `AppModule`, so there it warns and carries on.
 */
const DEV_FALLBACK_PREFIX = 'imix-dev-only-secret';

const logger = new Logger('AuthConfig');

/**
 * Reads a signing secret, or fails loudly. Called once at module construction
 * so a misconfigured production deploy dies at boot rather than at the first
 * login attempt.
 */
export function readSecret(variable: string): string {
  const secret = process.env[variable];

  if (secret && secret.length > 0) {
    return secret;
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      `${variable} is required in production. Generate one with: openssl rand -base64 32`,
    );
  }

  logger.warn(
    `${variable} is not set — falling back to a development secret. Tokens signed now are not secure and will not survive a restart with a real secret.`,
  );

  return `${DEV_FALLBACK_PREFIX}-${variable}`;
}
