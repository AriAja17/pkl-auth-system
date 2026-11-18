import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ArticleDto } from './dto/article.dto';

@Injectable()
export class ArticlesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.article.findMany({ orderBy: { createdAt: 'desc' } });
  }

  create(dto: ArticleDto) {
    return this.prisma.article.create({
      data: { title: dto.title.trim(), content: dto.content.trim() },
    });
  }

  async update(id: string, dto: ArticleDto) {
    await this.ensureExists(id);
    return this.prisma.article.update({
      where: { id },
      data: { title: dto.title.trim(), content: dto.content.trim() },
    });
  }

  async remove(id: string) {
    await this.ensureExists(id);
    await this.prisma.article.delete({ where: { id } });
    return { message: 'Artikel dihapus' };
  }

  private async ensureExists(id: string) {
    const article = await this.prisma.article.findUnique({ where: { id } });
    if (!article) {
      throw new NotFoundException('Artikel tidak ditemukan');
    }
  }
}