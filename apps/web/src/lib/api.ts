import type {
  CategoryDto,
  HealthResponse,
  Paginated,
  ProductDetailDto,
  ProductListItemDto,
  ProductListQuery,
} from '@imix/types';

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
  ) {
    super(`API ${path} responded ${status}`);
    this.name = 'ApiRequestError';
  }
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, path);
  }

  return (await response.json()) as T;
}

const catalogueInit: RequestInit = {
  next: { revalidate: CATALOGUE_REVALIDATE_SECONDS },
};

export function getHealth(): Promise<HealthResponse> {
  return apiFetch<HealthResponse>('/health', { cache: 'no-store' });
}

export function getCategories(): Promise<CategoryDto[]> {
  return apiFetch<CategoryDto[]>('/categories', catalogueInit);
}

export function getProducts(query: ProductListQuery = {}): Promise<Paginated<ProductListItemDto>> {
  const params = new URLSearchParams();

  if (query.category) params.set('category', query.category);
  if (query.featured !== undefined) params.set('featured', String(query.featured));
  if (query.page !== undefined) params.set('page', String(query.page));
  if (query.pageSize !== undefined) params.set('pageSize', String(query.pageSize));

  const search = params.size > 0 ? `?${params.toString()}` : '';
  return apiFetch<Paginated<ProductListItemDto>>(`/products${search}`, catalogueInit);
}

export function getProduct(slug: string): Promise<ProductDetailDto> {
  return apiFetch<ProductDetailDto>(`/products/${encodeURIComponent(slug)}`, catalogueInit);
}

/** Resolves to null on 404 so a page can render notFound() instead of erroring. */
export async function getProductOrNull(slug: string): Promise<ProductDetailDto | null> {
  try {
    return await getProduct(slug);
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 404) {
      return null;
    }
    throw error;
  }
}
