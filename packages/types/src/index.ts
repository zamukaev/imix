/**
 * @imix/types — the single source of truth for the API contract.
 *
 * Both `apps/api` and `apps/web` import from here, so a change to a response
 * shape breaks compilation on whichever side has not been updated.
 *
 * Phase 1.1 seeds only the primitives; the real DTOs arrive with the
 * Categories/Products modules in Phase 1.3.
 */

/**
 * An amount in integer **minor units** (cents/копейки) — never a float.
 * `199900` is €1 999,00.
 */
export type Money = number;

/** Envelope for every paginated list endpoint. */
export type Paginated<T> = {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
};

/** Shape NestJS' default exception filter serialises errors into. */
export type ApiError = {
  statusCode: number;
  message: string | string[];
  error?: string;
};

/** Response of `GET /health` — the end-to-end smoke test for the skeleton. */
export type HealthResponse = {
  status: 'ok' | 'degraded';
  service: string;
  uptime: number;
  database: 'up' | 'down';
};
