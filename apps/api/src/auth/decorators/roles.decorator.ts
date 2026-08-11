import { SetMetadata } from '@nestjs/common';
import type { Role } from '@imix/types';

export const ROLES_KEY = 'imix:roles';

/**
 * Restricts a handler (or a whole controller) to the listed roles.
 *
 * Always pair it with `JwtAuthGuard` — on its own `RolesGuard` has no caller to
 * check: `@UseGuards(JwtAuthGuard, RolesGuard) @Roles('ADMIN')`.
 */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
