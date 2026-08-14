import type {
  AdminCategoryDto,
  AdminHomeTileDto,
  AdminOrderDto,
  AdminProductDto,
  AdminProductListItemDto,
  CategoryWriteRequest,
  CreateProductRequest,
  HomeTileWriteRequest,
  Locale,
  OrderStatus,
  ProductWriteRequest,
  TileMoveDirection,
  UploadedAssetDto,
  VariantWriteRequest,
} from '@imix/types';
import { ApiRequestError } from './api';

/**
 * The admin's client for its own API.
 *
 * Every call goes to `/api/admin/...` on this origin, never to the API directly:
 * the session lives in an httpOnly cookie, so the route handler there is what
 * turns it into a bearer token. These functions therefore work in a client
 * component, which is what the forms need.
 *
 * `ApiRequestError` is reused so a form can render `toUserMessage(error, …)` the
 * same way checkout already does.
 */
const BASE = '/api/admin';

const NO_CONTENT = 204;

async function send<T>(
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<T> {
  const response = await fetch(`${BASE}${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, path, await readMessage(response));
  }

  if (response.status === NO_CONTENT) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

/**
 * Pulls the sentence out of whichever envelope arrived. NestJS sends
 * `{ message }` — a string for a refusal, an array for a validation failure,
 * where every broken field is worth showing at once.
 */
async function readMessage(response: Response): Promise<string | null> {
  try {
    const body: unknown = await response.json();

    if (typeof body === 'object' && body !== null && 'message' in body) {
      const { message } = body as { message: unknown };

      if (Array.isArray(message)) {
        return message.join('. ');
      }

      return typeof message === 'string' ? message : null;
    }

    return null;
  } catch {
    return null;
  }
}

export function listAdminCategories(): Promise<AdminCategoryDto[]> {
  return send('GET', '/categories');
}

export function createAdminCategory(
  body: CategoryWriteRequest,
): Promise<AdminCategoryDto> {
  return send('POST', '/categories', body);
}

export function updateAdminCategory(
  id: string,
  body: CategoryWriteRequest,
): Promise<AdminCategoryDto> {
  return send('PATCH', `/categories/${id}`, body);
}

export function deleteAdminCategory(id: string): Promise<void> {
  return send('DELETE', `/categories/${id}`);
}

export function listAdminProducts(): Promise<AdminProductListItemDto[]> {
  return send('GET', '/products');
}

export function createAdminProduct(
  body: CreateProductRequest,
): Promise<AdminProductDto> {
  return send('POST', '/products', body);
}

export function updateAdminProduct(
  id: string,
  body: ProductWriteRequest,
): Promise<AdminProductDto> {
  return send('PATCH', `/products/${id}`, body);
}

export function deleteAdminProduct(id: string): Promise<void> {
  return send('DELETE', `/products/${id}`);
}

/** The three variant calls answer with the whole product: its "from" prices move. */
export function addAdminVariant(
  productId: string,
  body: VariantWriteRequest,
): Promise<AdminProductDto> {
  return send('POST', `/products/${productId}/variants`, body);
}

export function updateAdminVariant(
  id: string,
  body: Partial<VariantWriteRequest>,
): Promise<AdminProductDto> {
  return send('PATCH', `/variants/${id}`, body);
}

export function deleteAdminVariant(id: string): Promise<AdminProductDto> {
  return send('DELETE', `/variants/${id}`);
}

export function createAdminHomeTile(
  body: HomeTileWriteRequest,
): Promise<AdminHomeTileDto> {
  return send('POST', '/home-tiles', body);
}

export function updateAdminHomeTile(
  id: string,
  body: HomeTileWriteRequest,
): Promise<AdminHomeTileDto> {
  return send('PATCH', `/home-tiles/${id}`, body);
}

export function deleteAdminHomeTile(id: string): Promise<void> {
  return send('DELETE', `/home-tiles/${id}`);
}

/** Answers with the whole list: moving one tile renumbers all of them. */
export function moveAdminHomeTile(
  id: string,
  direction: TileMoveDirection,
): Promise<AdminHomeTileDto[]> {
  return send('POST', `/home-tiles/${id}/move`, { direction });
}

/**
 * Moves one order along. The locale goes with it because the answer carries the
 * order's lines, and those are written per language.
 */
export function updateAdminOrderStatus(
  id: string,
  status: OrderStatus,
  locale: Locale,
): Promise<AdminOrderDto> {
  return send('PATCH', `/orders/${id}?locale=${locale}`, { status });
}

/**
 * Uploads one file. Multipart, so no `Content-Type` is set by hand — the browser
 * has to add the boundary parameter itself.
 */
export async function uploadAsset(file: File): Promise<UploadedAssetDto> {
  const body = new FormData();
  body.set('file', file);

  const response = await fetch(`${BASE}/upload`, {
    method: 'POST',
    body,
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new ApiRequestError(response.status, '/upload', await readMessage(response));
  }

  return (await response.json()) as UploadedAssetDto;
}
