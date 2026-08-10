import { Controller, Get, Query } from '@nestjs/common';
import type { CategoryDto } from '@imix/types';
import { LocalisedQueryDto } from '../common/dto/localised-query.dto';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll(@Query() query: LocalisedQueryDto): Promise<CategoryDto[]> {
    return this.categories.findAll(query.locale);
  }
}
