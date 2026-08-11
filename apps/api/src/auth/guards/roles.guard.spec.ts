import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { AccessTokenPayload, Role } from '@imix/types';
import { RolesGuard } from './roles.guard';

/**
 * `RolesGuard` is the only piece of the auth slice with no route to exercise it
 * yet — the first ADMIN endpoint lands with product CRUD in 3.3. Until then its
 * behaviour is pinned here, because "an empty `@Roles()` opens the handler" and
 * "no user means forbidden" are the kind of defaults that are easy to invert by
 * accident and expensive to notice.
 */
describe('RolesGuard', () => {
  const contextFor = (user?: AccessTokenPayload): ExecutionContext =>
    ({
      switchToHttp: () => ({ getRequest: () => ({ user }) }),
      getHandler: () => undefined,
      getClass: () => undefined,
    }) as unknown as ExecutionContext;

  const guardRequiring = (required: Role[] | undefined): RolesGuard => {
    const reflector = new Reflector();
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(required);

    return new RolesGuard(reflector);
  };

  const userWith = (role: Role): AccessTokenPayload => ({
    sub: 'user-id',
    email: 'someone@example.com',
    role,
    iat: 0,
    exp: 0,
  });

  it('lets an admin through an ADMIN-only handler', () => {
    expect(guardRequiring(['ADMIN']).canActivate(contextFor(userWith('ADMIN')))).toBe(
      true,
    );
  });

  it('refuses a shopper on an ADMIN-only handler', () => {
    expect(() =>
      guardRequiring(['ADMIN']).canActivate(contextFor(userWith('USER'))),
    ).toThrow(ForbiddenException);
  });

  it('refuses an unauthenticated caller', () => {
    expect(() =>
      guardRequiring(['ADMIN']).canActivate(contextFor(undefined)),
    ).toThrow(ForbiddenException);
  });

  it.each([
    ['a handler with no @Roles at all', undefined],
    ['an empty @Roles()', [] as Role[]],
  ])('narrows nothing on %s', (_label, required) => {
    // The guard only narrows; authenticating is JwtAuthGuard's job.
    expect(guardRequiring(required).canActivate(contextFor(undefined))).toBe(true);
  });
});
