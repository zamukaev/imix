/**
 * Single entry point for talking to the iMIX API.
 * Server Components call this directly; the base URL comes from the env so
 * local, preview and production deployments differ only by configuration.
 */

const DEFAULT_API_URL = 'http://localhost:4000';

export const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL ?? DEFAULT_API_URL;

/**
 * Fetches a JSON resource from the API.
 * Throws on a non-2xx response so callers can decide how to degrade.
 */
export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...init,
    headers: { Accept: 'application/json', ...init?.headers },
  });

  if (!response.ok) {
    throw new Error(`API ${path} responded ${response.status}`);
  }

  return (await response.json()) as T;
}
