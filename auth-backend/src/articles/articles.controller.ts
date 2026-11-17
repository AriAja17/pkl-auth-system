import { Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

@Controller('articles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArticlesController {
  @Get()
  @RequirePermissions('article.read')
  findAll() {
    return [{ id: 1, title: 'Contoh artikel' }];
  }

  @Post()
  @RequirePermissions('article.create')
  create() {
    return { message: 'Artikel dibuat (contoh)' };
  }

  @Put(':id')
  @RequirePermissions('article.update')
  update(@Param('id') id: string) {
    return { message: `Artikel ${id} diedit (contoh)` };
  }

  @Delete(':id')
  @RequirePermissions('article.delete')
  remove(@Param('id') id: string) {
    return { message: `Artikel ${id} dihapus (contoh)` };
  }
}