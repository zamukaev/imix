import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { OrdersModule } from '../orders/orders.module';
import { AdminCatalogueController } from './admin-catalogue.controller';
import { AdminCatalogueService } from './admin-catalogue.service';
import { AdminController } from './admin.controller';
import { AdminHomeTilesController } from './admin-home-tiles.controller';
import { AdminHomeTilesService } from './admin-home-tiles.service';
import { AdminOrdersController } from './admin-orders.controller';
import { AdminService } from './admin.service';
import { AdminUploadController } from './admin-upload.controller';
import { assetStorageProvider } from './storage/asset-storage.provider';
import { StorefrontHrefService } from './storefront-href.service';

@Module({
  // `AuthModule` for the guards on every controller here; `OrdersModule` because
  // the order book reuses `OrdersService` rather than growing a second mapper.
  imports: [AuthModule, OrdersModule],
  controllers: [
    AdminController,
    AdminCatalogueController,
    AdminHomeTilesController,
    AdminOrdersController,
    AdminUploadController,
  ],
  providers: [
    AdminService,
    AdminCatalogueService,
    AdminHomeTilesService,
    StorefrontHrefService,
    assetStorageProvider,
  ],
})
export class AdminModule {}
