import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type { CreateOrderRequest, OrderDto } from '@imix/types';
import { ApiRequestError, createOrder } from '@/lib/api';
import { ACCESS_COOKIE } from '@/lib/auth-cookies';
import { readSessionClaims } from '@/lib/jwt-claims';

const BAD_REQUEST = 400;
const BAD_GATEWAY = 502;

type OrderRouteResult = OrderDto | { message: string };

/**
 * Places an order on behalf of the browser.
 *
 * The checkout page is a client component and cannot read the httpOnly session
 * cookie — that is the whole point of it being httpOnly. So the order goes
 * through here, same-origin, and this handler turns the cookie into the bearer
 * token the API understands.
 *
 * The body is forwarded as it arrives. Every price, every total and every stock
 * check is the API's, so there is nothing here worth validating twice.
 */
export async function POST(request: Request): Promise<NextResponse<OrderRouteResult>> {
  let body: CreateOrderRequest;

  try {
    body = (await request.json()) as CreateOrderRequest;
  } catch {
    return NextResponse.json<OrderRouteResult>(
      { message: 'Expected a JSON body.' },
      { status: BAD_REQUEST },
    );
  }

  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  // Only a live token is forwarded. An expired one would be ignored by the API
  // anyway; the middleware is what keeps it fresh while somebody is browsing.
  const auth = readSessionClaims(accessToken) && accessToken
    ? { accessToken }
    : undefined;

  try {
    return NextResponse.json<OrderRouteResult>(await createOrder(body, auth));
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json<OrderRouteResult>(
        { message: error.detail ?? 'Unexpected error.' },
        { status: error.status },
      );
    }

    return NextResponse.json<OrderRouteResult>(
      { message: 'Unexpected error.' },
      { status: BAD_GATEWAY },
    );
  }
}
