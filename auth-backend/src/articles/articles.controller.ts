import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { ArticlesService } from './articles.service';
import { ArticleDto } from './dto/article.dto';

@Controller('articles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ArticlesController {
  constructor(private articlesService: ArticlesService) {}

  @Get()
  @RequirePermissions('read:article')
  findAll() {
    return this.articlesService.findAll();
  }

  @Post()
  @RequirePermissions('create:article')
  create(@Body() dto: ArticleDto) {
    return this.articlesService.create(dto);
  }

  @Put(':id')
  @RequirePermissions('update:article')
  update(@Param('id') id: string, @Body() dto: ArticleDto) {
    return this.articlesService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermissions('delete:article')
  remove(@Param('id') id: string) {
    return this.articlesService.remove(id);
  }
}