import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CategoriesModule } from './categories/categories.module';
import { HealthModule } from './health/health.module';
import { HomeTilesModule } from './home-tiles/home-tiles.module';
import { OrdersModule } from './orders/orders.module';
import { PaymentsModule } from './payments/payments.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [
    PrismaModule,
    HealthModule,
    AuthModule,
    CategoriesModule,
    ProductsModule,
    HomeTilesModule,
    OrdersModule,
    PaymentsModule,
  ],
})
export class AppModule {}
