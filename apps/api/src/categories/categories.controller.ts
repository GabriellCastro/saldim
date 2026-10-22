import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/public.decorator';
import { CATEGORIES } from './categories';
import { UNEXPECTED_TYPES } from './unexpected';

@Controller('categories')
export class CategoriesController {
  @Public()
  @Get()
  list() {
    return CATEGORIES;
  }

  @Public()
  @Get('unexpected')
  unexpected() {
    return UNEXPECTED_TYPES;
  }
}
