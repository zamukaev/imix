/**
 * Liveness for the storefront container.
 *
 * Deliberately shallow: it answers whether *this* process can serve a request,
 * and nothing else. Reaching through to the API here would make the storefront
 * unhealthy whenever the API is — Docker would restart a perfectly good web
 * container over a fault it cannot fix, and the shop would lose its cached
 * pages and its error states along with it. The API reports on the API, at
 * `GET /health`.
 */
export const dynamic = 'force-dynamic';

export function GET(): Response {
  return Response.json({ status: 'ok' });
}
