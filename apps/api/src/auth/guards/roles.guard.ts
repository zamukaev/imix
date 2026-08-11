import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Role } from '@imix/types';
import { ROLES_KEY } from '../decorators/roles.decorator';
import type { AuthenticatedRequest } from './jwt-auth.guard';

/**
 * Enforces `@Roles(...)`. A handler without the decorator is open to any
 * authenticated caller — the guard only narrows, it never authenticates, so it
 * belongs behind `JwtAuthGuard` in the same `@UseGuards(...)` call.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<Role[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest<AuthenticatedRequest>().user;

    if (!user || !required.includes(user.role)) {
      throw new ForbiddenException('This action requires a different role.');
    }

    return true;
  }
}
