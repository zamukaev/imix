/**
 * Who is asking. Mirrors the `Role` enum in the Prisma schema.
 *
 * Two roles and no hierarchy: a shopper owns their own orders, an admin owns
 * the shop. Anything finer-grained than that would be a permission system, and
 * a shop with one merchant does not need one.
 */
export const ROLES = ['USER', 'ADMIN'] as const;

export type Role = (typeof ROLES)[number];

/**
 * Password bounds. Here rather than in either app because both enforce them:
 * the register form so it can say what is wrong before a round trip, the API
 * because it is the one that decides.
 *
 * A floor and a ceiling, and no complexity rule — those push people towards
 * `Passw0rd!`, while length is the part that actually costs an attacker
 * something. The ceiling exists because hashing is deliberately slow work and
 * an unbounded password is an unbounded amount of it per request.
 */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 128;

/**
 * A user as the API is willing to describe them. `passwordHash` is deliberately
 * absent — the DTO is what leaves the server, so the column cannot leak by
 * someone forgetting to strip it.
 */
export type UserDto = {
  id: string;
  email: string;
  name: string | null;
  role: Role;
  /** ISO 8601 — JSON has no date type. */
  createdAt: string;
};

/** Request body of `POST /auth/register`. */
export type RegisterRequest = {
  email: string;
  password: string;
  name?: string;
};

/** Request body of `POST /auth/login`. */
export type LoginRequest = {
  email: string;
  password: string;
};

/**
 * Request body of `POST /auth/refresh`.
 *
 * The token travels in the body rather than a cookie because the API is
 * cookie-free by design: it is a separate origin from the storefront, and the
 * storefront is what owns the browser session (see ARCHITECTURE.md §4).
 */
export type RefreshRequest = {
  refreshToken: string;
};

/** Response of register, login and refresh alike. */
export type AuthResponse = {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
};

/**
 * The decoded access token. The role rides along so a guard can answer
 * "may they?" without a database round trip on every request — the cost is that
 * a role change only takes effect once the current access token expires.
 */
export type AccessTokenPayload = {
  /** The user id. `sub` is the JWT registered claim name for it. */
  sub: string;
  email: string;
  role: Role;
  /** Seconds since the epoch, both set by the signer. */
  iat: number;
  exp: number;
};
