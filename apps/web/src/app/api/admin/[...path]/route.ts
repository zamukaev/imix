import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { apiBaseUrl } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { readSessionClaims } from '@/lib/jwt-claims';

const UNAUTHORIZED = 401;
const BAD_GATEWAY = 502;
const NO_CONTENT = 204;

type RouteContext = { params: Promise<{ path: string[] }> };

/**
 * The admin's way to the API.
 *
 * Everything under `/admin` in the storefront is client-interactive — forms,
 * variant rows, a file picker — and a client component cannot read the httpOnly
 * session cookie. That is the point of it being httpOnly. So the browser talks
 * to this handler, same-origin, and it attaches the bearer token.
 *
 * One catch-all rather than a handler per endpoint: the shape of every admin
 * call is identical (forward the body, attach the token, pass the answer back),
 * and thirteen files that each do that would be thirteen places for one of them
 * to forget the token. The path is pinned under `/admin/` so this cannot be
 * pointed at the rest of the API, and the API's own role guard is what actually
 * decides — a stale cookie gets a 403 from there, not a shortcut through here.
 */
async function forward(request: Request, context: RouteContext): Promise<Response> {
  const { path } = await context.params;
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;

  // Only a live token is forwarded; an expired one would earn a 401 from the API
  // anyway, and answering here says plainly that the session, not the request,
  // is the problem.
  if (!accessToken || !readSessionClaims(accessToken)) {
    return NextResponse.json(
      { message: 'Your session has expired. Sign in again.' },
      { status: UNAUTHORIZED },
    );
  }

  const target = new URL(
    `/admin/${path.map(encodeURIComponent).join('/')}`,
    apiBaseUrl,
  );
  target.search = new URL(request.url).search;

  const headers = new Headers({ Authorization: `Bearer ${accessToken}` });
  const contentType = request.headers.get('content-type');

  // Passed through as-is so multipart uploads keep their boundary parameter.
  if (contentType) {
    headers.set('content-type', contentType);
  }

  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      // Buffered rather than streamed: the size cap lives on the API, the
      // largest thing through here is one product photograph, and streaming a
      // request body needs `duplex` support this does not otherwise require.
      body: hasBody(request.method) ? await request.arrayBuffer() : undefined,
      cache: 'no-store',
    });

    if (response.status === NO_CONTENT) {
      return new NextResponse(null, { status: NO_CONTENT });
    }

    // The API's own status and body, unedited — it is the one that decided, and
    // the form has been written to render its message.
    return new NextResponse(await response.text(), {
      status: response.status,
      headers: { 'content-type': response.headers.get('content-type') ?? 'application/json' },
    });
  } catch {
    return NextResponse.json(
      { message: 'The API is unreachable.' },
      { status: BAD_GATEWAY },
    );
  }
}

function hasBody(method: string): boolean {
  return method !== 'GET' && method !== 'HEAD';
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
