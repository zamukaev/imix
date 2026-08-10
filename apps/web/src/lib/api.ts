import type {
  ApiError,
  CategoryDto,
  CreateOrderRequest,
  Currency,
  HealthResponse,
  HomeTileDto,
  Locale,
  OrderDto,
  Paginated,
  PaymentIntentDto,
  ProductDetailDto,
  ProductListItemDto,
  ProductListQuery,
} from '@imix/types';

/**
 * Language and currency are required at every call site rather than defaulted
 * here. The API would happily default them to Russian roubles, but a page that
 * forgot to pass the shopper's choice would then render the wrong price
 * silently — this way it does not compile.
 */
export type LocaleContext = { locale: Locale };
export type PriceContext = LocaleContext & { currency: Currency };

/**
 * Single entry point for talking to the iMIX API.
 * Server Components call this directly; the base URL comes from the env so
 * local, preview and production deployments differ only by configuration.
 */

const DEFAULT_API_URL = 'http://localhost:4000';

/** Catalogue data changes rarely — revalidate rather than refetch per request. */
const CATALOGUE_REVALIDATE_SECONDS = 60;

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;

/** Thrown for any non-2xx response so callers can branch on the status. */
export class ApiRequestError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
    /** The API's own explanation, when it sent one worth showing. */
    readonly detail: string | null = null,
  ) {
    super(`API ${path} responded ${status}`);
    this.name = 'ApiRequestError';
  }
}

/**
 * Turns anything thrown by a request into a line worth showing.
 *
 * The fallback is passed in rather than kept here because it has to be
 * translated, and this module has no locale. Unknown errors (a dropped
 * connection, a bug) collapse to it rather than leaking their internals — as
 * does any API detail the shopper cannot act on.
 */
export function toUserMessage(error: unknown, fallback: string): string {
  return error instanceof ApiRequestError ? (error.detail ?? fallback) : fallback;
}

/**
 * Pulls the message out of NestJS' error envelope. Validation failures arrive as
 * an array of messages; anything unparseable becomes null so the caller falls
 * back to a generic line rather than showing a stack trace.
 */
async function readErrorDetail(response: Response): Promise<string | null> {
  try {
    const body: Partial<ApiError> = await response.json();

    if (Array.isArray(body.message)) {
      return body.message.join('. ');
    }

    return typeof body.message === 'string' ? body.message : null;
  } catch {
    return null;
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, path, await readErrorDetail(response));
  }

  return (await response.json()) as T;
}

/** Mutations are always live: no cache, JSON in, JSON out. */
function apiPost<T>(path: string, body: unknown): Promise<T> {
  return apiFetch<T>(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    cache: 'no-store',
  });
}

const catalogueInit: RequestInit = {
  next: { revalidate: CATALOGUE_REVALIDATE_SECONDS },
};

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health', { cache: 'no-store' });
}

export function getCategories(context: LocaleContext): Promise<CategoryDto[]> {
  return apiFetch<CategoryDto[]>(
    `/categories?${new URLSearchParams({ locale: context.locale })}`,
    catalogueInit,
  );
}

/**
 * The home page's tiles. Editorial content rather than catalogue data, so no
 * currency — a tile carries copy and a picture, never a price.
 */
export function getHomeTiles(context: LocaleContext): Promise<HomeTileDto[]> {
  return apiFetch<HomeTileDto[]>(
    `/home-tiles?${new URLSearchParams({ locale: context.locale })}`,
    catalogueInit,
  );
}

export function getProducts(
  context: PriceContext,
  query: Omit<ProductListQuery, keyof PriceContext> = {},
): Promise<Paginated<ProductListItemDto>> {
  const params = new URLSearchParams({
    locale: context.locale,
    currency: context.currency,
  });

  if (query.category) params.set('category', query.category);
  if (query.featured !== undefined) params.set('featured', String(query.featured));
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));

  return apiFetch<Paginated<ProductListItemDto>>(`/products?${params}`, catalogueInit);
}

export function getProduct(
  slug: string,
  context: PriceContext,
): Promise<ProductDetailDto> {
  const params = new URLSearchParams({
    locale: context.locale,
    currency: context.currency,
  });

  return apiFetch<ProductDetailDto>(
    `/products/${encodeURIComponent(slug)}?${params}`,
    catalogueInit,
  );
}

/**
 * The currency travels in the body, not the query string: it decides what the
 * shopper is charged, so it belongs to the order rather than to the rendering
 * of the response.
 */
export function createOrder(request: CreateOrderRequest): Promise<OrderDto> {
  return apiPost<OrderDto>('/orders', request);
}

/**
 * The order id is the only credential the confirmation page has, so this must
 * not be cached — a shopper reloading after payment needs the settled status.
 */
export function getOrder(id: string, context: LocaleContext): Promise<OrderDto> {
  const params = new URLSearchParams({ locale: context.locale });

  return apiFetch<OrderDto>(`/orders/${encodeURIComponent(id)}?${params}`, {
    cache: 'no-store',
  });
}

export function createPaymentIntent(orderId: string): Promise<PaymentIntentDto> {
  return apiPost<PaymentIntentDto>('/payments/intent', { orderId });
}

/** Resolves to null on 404 so a page can render notFound() instead of erroring. */
export async function getProductOrNull(
  slug: string,
  context: PriceContext,
): Promise<ProductDetailDto | null> {
  return nullOn404(() => getProduct(slug, context));
}

export async function getOrderOrNull(
  id: string,
  context: LocaleContext,
): Promise<OrderDto | null> {
  return nullOn404(() => getOrder(id, context));
}

async function nullOn404<T>(request: () => Promise<T>): Promise<T | null> {
  try {
    return await request();
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
