import { Controller, Get, UseGuards } from '@nestjs/common';
import type { AdminStatsDto } from '@imix/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminService } from './admin.service';

/**
 * Everything under `/admin` is ADMIN-only, so the guards sit on the controller
 * rather than on each handler: a route added here is protected by default, and
 * opening one up has to be a deliberate act instead of the result of forgetting
 * a decorator.
 *
 * The storefront also keeps unauthorised visitors out of `/admin` in its
 * middleware, but that is only about which page they see. This is the part that
 * decides what they get (ARCHITECTURE.md §4).
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get('stats')
  stats(): Promise<AdminStatsDto> {
    return this.admin.stats();
  }
}
