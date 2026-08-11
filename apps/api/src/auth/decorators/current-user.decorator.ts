import { ExecutionContext, createParamDecorator } from '@nestjs/common';
import type { AccessTokenPayload } from '@imix/types';
import type { AuthenticatedRequest } from '../guards/jwt-auth.guard';

/**
 * The verified token payload behind `JwtAuthGuard`, or `undefined` behind
 * `OptionalJwtAuthGuard`. The type is honest about the second case, so a
 * handler on a public route has to decide what it does without a caller.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AccessTokenPayload | undefined =>
    context.switchToHttp().getRequest<AuthenticatedRequest>().user,
);
