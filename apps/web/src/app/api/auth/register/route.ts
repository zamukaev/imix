import type { NextResponse } from 'next/server';
import { register } from '@/lib/api';
import {
  authResponse,
  badRequest,
  readJsonBody,
  stringField,
  type AuthRouteResult,
} from '@/lib/auth-route';

/**
 * Creates a shopper account and signs them straight in.
 *
 * There is no `role` to forward: the API's DTO has no such field and rejects
 * one outright. The first ADMIN comes from the seed.
 */
export async function POST(request: Request): Promise<NextResponse<AuthRouteResult>> {
  const body = await readJsonBody(request);
  const email = stringField(body, 'email');
  const password = stringField(body, 'password');
  const name = stringField(body, 'name')?.trim();

  if (!email || !password) {
    return badRequest('Email and password are required.');
  }

  return authResponse(() =>
    register({ email, password, ...(name ? { name } : {}) }),
  );
}
