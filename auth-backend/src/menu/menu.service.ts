import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../authorization/principal';
import { AuditService, auditActor } from '../audit/audit.service';
import { SearchQueryDto } from '../common/dto/pagination.dto';
import { buildMenuTree } from './menu-tree';
import { CreateMenuDto } from './dto/create-menu.dto';
import { UpdateMenuDto } from './dto/update-menu.dto';
import { MenuPermissionsDto } from './dto/menu-permissions.dto';

@Injectable()
export class MenuService {
  constructor(
    private prisma: PrismaService,
    @Optional() private audit?: AuditService,
  ) {}

  private async mutate<T>(
    actor: Principal | undefined,
    action: string,
    resourceId: string,
    before: unknown,
    after: unknown,
    operation: (tx: any) => Promise<T>,
  ): Promise<T> {
    if (!this.audit || !actor) {
      return this.prisma.$transaction((tx) => operation(tx));
    }
    return this.prisma.$transaction(async (tx) => {
      const result = await operation(tx);
      await this.audit!.record(
        {
          ...auditActor(actor),
          action,
          resourceType: 'menu',
          resourceId,
          before,
          after,
        },
        tx,
      );
      return result;
    });
  }

  private view(menu: any) {
    return {
      id: menu.id,
      name: menu.name,
      url: menu.url ?? null,
      icon: menu.icon ?? null,
      parentId: menu.parentId ?? null,
      order: menu.order,
      description: menu.description ?? null,
      isActive: menu.isActive,
      createdAt: menu.createdAt,
      updatedAt: menu.updatedAt,
      permissions: (menu.permissions ?? [])
        .map((mp: any) => mp.permission.key)
        .sort(),
      children: [],
    };
  }

  private async loadMenu(id: string): Promise<any> {
    const menu = await this.prisma.menu.findUnique({
      where: { id },
      include: { permissions: { include: { permission: true } } },
    });
    if (!menu) throw new NotFoundException('Menu tidak ditemukan');
    return menu;
  }

  private async validatePermissions(permissionIds: string[]) {
    const unique = [...new Set(permissionIds)];
    const permissions = await this.prisma.permission.findMany({
      where: { id: { in: unique } },
      select: { id: true },
    });
    if (permissions.length !== unique.length) {
      throw new BadRequestException('Permission tidak dikenal');
    }
  }

  /** Direct and transitive cycles are rejected (doc 06 §6). */
  private async assertNoCycle(menuId: string, parentId: string | null): Promise<void> {
    if (!parentId) return;
    if (parentId === menuId) {
      throw new BadRequestException('Menu tidak boleh menjadi induk dirinya sendiri');
    }
    const menus = await this.prisma.menu.findMany({
      select: { id: true, parentId: true },
    });
    const byId = new Map(menus.map((menu: any) => [menu.id, menu]));
    const seen = new Set<string>();
    let current = byId.get(parentId) as { id: string; parentId: string | null } | undefined;
    while (current) {
      if (current.id === menuId || current.parentId === menuId) {
        throw new BadRequestException('Relasi induk membentuk siklus');
      }
      if (seen.has(current.id)) {
        throw new BadRequestException('Relasi induk membentuk siklus');
      }
      seen.add(current.id);
      current = current.parentId ? (byId.get(current.parentId) as any) : undefined;
    }
  }

  async list(query: SearchQueryDto) {
    const menus = await this.prisma.menu.findMany({
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
      include: { permissions: { include: { permission: true } } },
    });
    const items = buildMenuTree(menus.map((menu: any) => this.view(menu)) as any[]);
    return {
      items,
      total: menus.length,
      page: query.page ?? 1,
      limit: query.limit ?? 10,
    };
  }

  async get(id: string) {
    return this.view(await this.loadMenu(id));
  }

  async create(dto: CreateMenuDto, actor?: Principal) {
    if (dto.parentId) {
      const parent = await this.prisma.menu.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException('Parent menu tidak ditemukan');
    }
    if (dto.permissionIds?.length) await this.validatePermissions(dto.permissionIds);

    const created = await this.mutate(
      actor,
      'menu.create',
      dto.name,
      null,
      { name: dto.name, url: dto.url ?? null, parentId: dto.parentId ?? null },
      (tx) =>
        tx.menu.create({
          data: {
            name: dto.name,
            url: dto.url,
            icon: dto.icon,
            parentId: dto.parentId,
            order: dto.order ?? 0,
            description: dto.description,
            isActive: dto.isActive ?? true,
            permissions: {
              create: (dto.permissionIds ?? []).map((id) => ({
                permission: { connect: { id } },
              })),
            },
          },
          include: { permissions: { include: { permission: true } } },
        }),
    );
    return this.view(created);
  }

  async update(id: string, dto: UpdateMenuDto, actor?: Principal) {
    const existing = await this.loadMenu(id);
    const parentId = dto.parentId !== undefined ? dto.parentId : existing.parentId;
    await this.assertNoCycle(id, parentId);
    if (dto.parentId && dto.parentId !== existing.parentId) {
      const parent = await this.prisma.menu.findUnique({ where: { id: dto.parentId } });
      if (!parent) throw new BadRequestException('Parent menu tidak ditemukan');
    }
    if (dto.permissionIds?.length) await this.validatePermissions(dto.permissionIds);

    const updated = await this.mutate(
      actor,
      'menu.update',
      id,
      { id, name: existing.name, url: existing.url, parentId: existing.parentId },
      { id, name: dto.name ?? existing.name, parentId: parentId ?? null },
      async (tx) => {
        const menu = await tx.menu.update({
          where: { id },
          data: {
            name: dto.name,
            url: dto.url,
            icon: dto.icon,
            parentId: dto.parentId,
            order: dto.order,
            description: dto.description,
            isActive: dto.isActive,
          },
        });
        if (dto.permissionIds) {
          await tx.menuPermission.deleteMany({ where: { menuId: id } });
          if (dto.permissionIds.length > 0) {
            await tx.menuPermission.createMany({
              data: [...new Set(dto.permissionIds)].map((permissionId) => ({
                menuId: id,
                permissionId,
              })),
            });
          }
        }
        return menu;
      },
    );
    return this.get(updated.id);
  }

  async remove(id: string, actor?: Principal) {
    const existing = await this.loadMenu(id);
    // DB handles children (parentId SET NULL) and MenuPermission (CASCADE).
    await this.mutate(
      actor,
      'menu.delete',
      id,
      { id, name: existing.name, parentId: existing.parentId ?? null },
      null,
      (tx) => tx.menu.delete({ where: { id } }),
    );
    return { message: 'Menu dihapus' };
  }

  async setPermissions(id: string, dto: MenuPermissionsDto, actor?: Principal) {
    await this.loadMenu(id);
    if (dto.permissionIds.length) await this.validatePermissions(dto.permissionIds);
    await this.mutate(
      actor,
      'menu.permissions.update',
      id,
      { id },
      { id, permissionIds: dto.permissionIds },
      async (tx) => {
        await tx.menuPermission.deleteMany({ where: { menuId: id } });
        await tx.menuPermission.createMany({
          data: [...new Set(dto.permissionIds)].map((permissionId) => ({
            menuId: id,
            permissionId,
          })),
        });
      },
    );
    return this.get(id);
  }
}
