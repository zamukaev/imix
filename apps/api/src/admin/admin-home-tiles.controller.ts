import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import type { AdminHomeTileDto } from '@imix/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminHomeTilesService } from './admin-home-tiles.service';
import { MoveHomeTileDto, WriteHomeTileDto } from './dto/write-home-tile.dto';

/**
 * The write side of the home page.
 *
 * The public `GET /home-tiles` stays exactly as it was: published tiles only,
 * one language, incomplete actions dropped. This is the other half — every tile
 * including drafts, every column, both languages.
 */
@Controller('admin/home-tiles')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminHomeTilesController {
  constructor(private readonly tiles: AdminHomeTilesService) {}

  @Get()
  findAll(): Promise<AdminHomeTileDto[]> {
    return this.tiles.findAll();
  }

  @Post()
  create(@Body() dto: WriteHomeTileDto): Promise<AdminHomeTileDto> {
    return this.tiles.create(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: WriteHomeTileDto,
  ): Promise<AdminHomeTileDto> {
    return this.tiles.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id') id: string): Promise<void> {
    return this.tiles.remove(id);
  }

  /**
   * Answers with the whole list, because moving one tile renumbers all of them —
   * the page would otherwise be showing positions that are already stale.
   */
  @Post(':id/move')
  @HttpCode(HttpStatus.OK)
  move(
    @Param('id') id: string,
    @Body() dto: MoveHomeTileDto,
  ): Promise<AdminHomeTileDto[]> {
    return this.tiles.move(id, dto.direction);
  }
}
