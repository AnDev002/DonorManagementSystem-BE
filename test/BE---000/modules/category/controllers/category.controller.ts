import { Body, Controller, Delete, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { CategoryService } from '../category.service';
import { Public } from 'src/common/decorators/public.decorator';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  @Get()
  async getCategories(@Query('parentId') parentId?: string) {
    // Nếu client gửi string "null" hoặc undefined, xử lý về null thực
    const pId = parentId === 'null' || !parentId ? undefined : parentId;
    return this.categoryService.getCategories(pId);
  }

  @Get('search')
  async search(@Query('q') q: string) {
    return this.categoryService.searchCategories(q);
  }

  @Public()
  @Get('tree')
  async getCategoryTree() {
    return this.categoryService.getCategoryTree();
  }

  @Post()
  // @Roles(Role.ADMIN) // Uncomment nếu cần bảo mật
  create(@Body() createCategoryDto: any) {
    return this.categoryService.create(createCategoryDto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateCategoryDto: any) {
    return this.categoryService.update(id, updateCategoryDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.categoryService.remove(id);
  }

  @Post('batch-update')
  async updateBatch(@Body() items: any[]) {
      return this.categoryService.updateBatch(items);
  }
}