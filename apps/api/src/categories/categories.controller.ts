import { Controller, Get } from '@nestjs/common';
import type { CategoryDto } from '@imix/types';
import { CategoriesService } from './categories.service';

@Controller('categories')
export class CategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  findAll(): Promise<CategoryDto[]> {
    return this.categories.findAll();
  }
}
