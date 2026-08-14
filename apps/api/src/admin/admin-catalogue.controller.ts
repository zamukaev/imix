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
import type {
  AdminCategoryDto,
  AdminProductDto,
  AdminProductListItemDto,
} from '@imix/types';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { AdminCatalogueService } from './admin-catalogue.service';
import { WriteCategoryDto } from './dto/write-category.dto';
import { CreateProductDto, WriteProductDto } from './dto/write-product.dto';
import { PatchVariantDto, WriteVariantDto } from './dto/write-variant.dto';

/**
 * The write side of the catalogue.
 *
 * Reads here are not the storefront's reads: they carry both languages and both
 * prices, because the person editing the shop owns all of it. The public
 * `/products` and `/categories` endpoints are untouched by any of this.
 *
 * Guards on the controller, so a route added below is closed by default.
 */
@Controller('admin')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('ADMIN')
export class AdminCatalogueController {
  constructor(private readonly catalogue: AdminCatalogueService) {}

  @Get('categories')
  listCategories(): Promise<AdminCategoryDto[]> {
    return this.catalogue.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: WriteCategoryDto): Promise<AdminCategoryDto> {
    return this.catalogue.createCategory(dto);
  }

  @Patch('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: WriteCategoryDto,
  ): Promise<AdminCategoryDto> {
    return this.catalogue.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('id') id: string): Promise<void> {
    return this.catalogue.deleteCategory(id);
  }

  @Get('products')
  listProducts(): Promise<AdminProductListItemDto[]> {
    return this.catalogue.listProducts();
  }

  @Get('products/:id')
  findProduct(@Param('id') id: string): Promise<AdminProductDto> {
    return this.catalogue.findProduct(id);
  }

  @Post('products')
  createProduct(@Body() dto: CreateProductDto): Promise<AdminProductDto> {
    return this.catalogue.createProduct(dto);
  }

  @Patch('products/:id')
  updateProduct(
    @Param('id') id: string,
    @Body() dto: WriteProductDto,
  ): Promise<AdminProductDto> {
    return this.catalogue.updateProduct(id, dto);
  }

  @Delete('products/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteProduct(@Param('id') id: string): Promise<void> {
    return this.catalogue.deleteProduct(id);
  }

  /**
   * The three variant routes answer with the whole product rather than the
   * variant: adding or removing one moves the product's derived "from" prices,
   * and the form would otherwise be showing a number that is already stale.
   */
  @Post('products/:id/variants')
  addVariant(
    @Param('id') id: string,
    @Body() dto: WriteVariantDto,
  ): Promise<AdminProductDto> {
    return this.catalogue.addVariant(id, dto);
  }

  @Patch('variants/:id')
  updateVariant(
    @Param('id') id: string,
    @Body() dto: PatchVariantDto,
  ): Promise<AdminProductDto> {
    return this.catalogue.updateVariant(id, dto);
  }

  @Delete('variants/:id')
  deleteVariant(@Param('id') id: string): Promise<AdminProductDto> {
    return this.catalogue.deleteVariant(id);
  }
}
