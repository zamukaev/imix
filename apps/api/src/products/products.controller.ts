import { Controller, Get, Param, Query } from '@nestjs/common';
import type {
  Paginated,
  ProductDetailDto,
  ProductListItemDto,
} from '@imix/types';
import { FindProductsQueryDto } from './dto/find-products-query.dto';
import { ProductsService } from './products.service';

@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  @Get()
  findMany(
    @Query() query: FindProductsQueryDto,
  ): Promise<Paginated<ProductListItemDto>> {
    return this.products.findMany(query);
  }

  @Get(':slug')
  findOne(@Param('slug') slug: string): Promise<ProductDetailDto> {
    return this.products.findBySlug(slug);
  }
}
