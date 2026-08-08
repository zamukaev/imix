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
