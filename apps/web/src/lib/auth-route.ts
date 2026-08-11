import { NextResponse } from 'next/server';
import type { AuthResponse, UserDto } from '@imix/types';
import { ApiRequestError } from './api';
import { setAuthCookies } from './auth-cookies';

/**
 * What a form gets back from `/api/auth/*`: the account on success, a single
 * line to show on failure. Tokens never reach the browser as data — they leave
 * this handler as httpOnly cookies and nothing else.
 */
export type AuthRouteResult = UserDto | { message: string };

const UNEXPECTED = 'Unexpected error.';
const BAD_GATEWAY = 502;
const BAD_REQUEST = 400;

/**
 * Runs an API auth call and turns its outcome into a response: cookies and the
 * user on success, the API's own explanation and status on a refusal.
 *
 * The API's message is passed through rather than rewritten. It is already the
 * right one ("Invalid email or password.") and it is the API that decides which
 * refusals are worth explaining — the form only has to render it.
 */
export async function authResponse(
  issue: () => Promise<AuthResponse>,
): Promise<NextResponse<AuthRouteResult>> {
  try {
    const tokens = await issue();
    const response = NextResponse.json<AuthRouteResult>(tokens.user);

    setAuthCookies(response.cookies, tokens);

    return response;
  } catch (error) {
    if (error instanceof ApiRequestError) {
      return NextResponse.json<AuthRouteResult>(
        { message: error.detail ?? UNEXPECTED },
        { status: error.status },
      );
    }

    // The API is unreachable rather than unhappy — that is this server's
    // problem to report, not a 500 pretending the request was wrong.
    return NextResponse.json<AuthRouteResult>(
      { message: UNEXPECTED },
      { status: BAD_GATEWAY },
    );
  }
}

/** Reads a JSON body without trusting that there is one. */
export async function readJsonBody(
  request: Request,
): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();

    return typeof body === 'object' && body !== null
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

export function badRequest(message: string): NextResponse<AuthRouteResult> {
  return NextResponse.json<AuthRouteResult>({ message }, { status: BAD_REQUEST });
}

/** Narrows one field of an untrusted body; anything else becomes undefined. */
export function stringField(
  body: Record<string, unknown> | null,
  key: string,
): string | undefined {
  const value = body?.[key];

  return typeof value === 'string' ? value : undefined;
}
