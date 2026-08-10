import { Module } from '@nestjs/common';
import { HomeTilesController } from './home-tiles.controller';
import { HomeTilesService } from './home-tiles.service';

@Module({
  controllers: [HomeTilesController],
  providers: [HomeTilesService],
})
export class HomeTilesModule {}
