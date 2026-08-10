import { Controller, Get, Query } from '@nestjs/common';
import type { HomeTileDto } from '@imix/types';
import { LocalisedQueryDto } from '../common/dto/localised-query.dto';
import { HomeTilesService } from './home-tiles.service';

@Controller('home-tiles')
export class HomeTilesController {
  constructor(private readonly homeTiles: HomeTilesService) {}

  /**
   * Read-only and public. The write side lands with the admin in Phase 3 and
   * goes behind the ADMIN role guard — the shop window is not something an
   * anonymous caller may rearrange.
   */
  @Get()
  findAll(@Query() query: LocalisedQueryDto): Promise<HomeTileDto[]> {
    return this.homeTiles.findAll(query.locale);
  }
}
