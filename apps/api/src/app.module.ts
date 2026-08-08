import { Module } from '@nestjs/common';
import { CategoriesModule } from './categories/categories.module';
import { HealthModule } from './health/health.module';
import { PrismaModule } from './prisma/prisma.module';
import { ProductsModule } from './products/products.module';

@Module({
  imports: [PrismaModule, HealthModule, CategoriesModule, ProductsModule],
})
export class AppModule {}
