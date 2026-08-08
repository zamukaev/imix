import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@imix/types';
import { PrismaService } from '../prisma/prisma.service';

const SERVICE_NAME = 'imix-api';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async check(): Promise<HealthResponse> {
    const database = await this.probeDatabase();

    return {
      status: database === 'up' ? 'ok' : 'degraded',
      service: SERVICE_NAME,
      uptime: Math.floor(process.uptime()),
      database,
    };
  }

  /** A failing probe degrades the response rather than throwing — the endpoint
   * has to stay reachable precisely when the database is not. */
  private async probeDatabase(): Promise<HealthResponse['database']> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return 'up';
    } catch {
      return 'down';
    }
  }
}
