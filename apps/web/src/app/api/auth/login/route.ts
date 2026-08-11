import type { NextResponse } from 'next/server';
import { login } from '@/lib/api';
import {
  authResponse,
  badRequest,
  readJsonBody,
  stringField,
  type AuthRouteResult,
} from '@/lib/auth-route';

/**
 * Exchanges credentials for a session.
 *
 * The credentials go from the browser to this handler to the API; the tokens
 * come back the other way and stop here, as httpOnly cookies. Validation proper
 * belongs to the API — this only refuses a body that has no fields to forward.
 */
export async function POST(request: Request): Promise<NextResponse<AuthRouteResult>> {
  const body = await readJsonBody(request);
  const email = stringField(body, 'email');
  const password = stringField(body, 'password');

  if (!email || !password) {
    return badRequest('Email and password are required.');
  }

  return authResponse(() => login({ email, password }));
}
