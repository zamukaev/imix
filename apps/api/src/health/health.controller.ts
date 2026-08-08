import { Controller, Get } from '@nestjs/common';
import type { HealthResponse } from '@imix/types';

const SERVICE_NAME = 'imix-api';

@Controller('health')
export class HealthController {
  @Get()
  check(): HealthResponse {
    return {
      status: 'ok',
      service: SERVICE_NAME,
      uptime: Math.floor(process.uptime()),
    };
  }
}
