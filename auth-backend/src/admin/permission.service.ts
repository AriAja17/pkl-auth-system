import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, auditActor } from '../audit/audit.service';
import { Principal } from '../authorization/principal';
import { SYSTEM_ROLE_NAME, isProtectedPermissionKey } from '../authorization/constants';
import { POLICIES } from '../authorization/policies';
import { PERMISSION_KEY_PATTERN } from '../common/validation/rules';
import { SearchQueryDto } from '../common/dto/pagination.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';

@Injectable()
export class PermissionService {
  constructor(
    private prisma: PrismaService,
    @Optional() private audit?: AuditService,
  ) {}

  private async mutate<T>(
    actor: Principal | undefined,
    action: string,
    resourceId: string | ((result: T) => string),
    before: unknown,
    after: Record<string, unknown> | null | ((result: T) => unknown),
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
          resourceType: 'permission',
          resourceId:
            typeof resourceId === 'function'
              ? (resourceId as (result: T) => string)(result)
              : resourceId,
          before,
          after: typeof after === 'function' ? (after as (result: T) => unknown)(result) : after,
        },
        tx,
      );
      return result;
    });
  }

  private view(permission: any) {
    return {
      id: permission.id,
      key: permission.key,
      description: permission.description ?? null,
      isProtected: permission.isProtected,
      createdAt: permission.createdAt,
      roles: (permission.roles ?? []).map((rp: any) => rp.role.name).sort(),
    };
  }

  async list(query: SearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = query.search
      ? { key: { contains: query.search, mode: 'insensitive' as const } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.permission.findMany({
        where,
        orderBy: { key: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { roles: { include: { role: true } } },
      }),
      this.prisma.permission.count({ where }),
    ]);
    return { items: items.map((p: any) => this.view(p)), total, page, limit };
  }

  async get(id: string) {
    const permission = await this.prisma.permission.findUnique({
      where: { id },
      include: { roles: { include: { role: true } } },
    });
    if (!permission) throw new NotFoundException('Permission tidak ditemukan');
    return this.view(permission);
  }

  async create(dto: CreatePermissionDto, actor: Principal) {
    if (!PERMISSION_KEY_PATTERN.test(dto.key)) {
      throw new BadRequestException('Permission key harus berformat action:resource');
    }
    if (dto.isProtected && !actor.isSystem) {
      throw new ForbiddenException(`Hanya ${SYSTEM_ROLE_NAME} yang boleh menandai protected`);
    }
    if (await this.prisma.permission.findUnique({ where: { key: dto.key } })) {
      throw new ConflictException('Permission key sudah terdaftar');
    }

    const systemRole = await this.prisma.role.findFirst({
      where: { name: SYSTEM_ROLE_NAME },
    });
    if (!systemRole) {
      throw new NotFoundException(`Role ${SYSTEM_ROLE_NAME} tidak ditemukan`);
    }

    // Permission + assignment to superadmin are atomic. Creating a Permission row
    // never creates an endpoint or application feature.
    const created = await this.mutate(
      actor,
      'permission.create',
      (created: any) => created.id,
      null,
      (created: any) => ({
        id: created.id,
        key: dto.key,
        description: created.description ?? null,
        isProtected: created.isProtected ?? false,
      }),
      async (tx) => {
        const permission = await tx.permission.create({
          data: {
            key: dto.key,
            description: dto.description,
            isProtected: dto.isProtected ?? false,
          },
        });
        await tx.rolePermission.create({
          data: { roleId: systemRole.id, permissionsId: permission.id },
        });
        return permission;
      },
    );
    return this.view({ ...created, roles: [{ role: { name: SYSTEM_ROLE_NAME } }] });
  }

  async update(id: string, dto: UpdatePermissionDto, actor: Principal) {
    const permission = await this.prisma.permission.findUnique({ where: { id } });
    if (!permission) throw new NotFoundException('Permission tidak ditemukan');
    if ((permission.isProtected || isProtectedPermissionKey(permission.key)) && !actor.isSystem) {
      throw new ForbiddenException('Permission sistem tidak boleh diubah');
    }
    if (dto.isProtected === false && permission.isProtected && !actor.isSystem) {
      throw new ForbiddenException('Protected flag hanya diubah oleh superadmin');
    }

    const isProtected =
      actor.isSystem && dto.isProtected !== undefined
        ? dto.isProtected
        : permission.isProtected;
    const updated = await this.mutate(
      actor,
      'permission.update',
      id,
      {
        id,
        key: permission.key,
        description: permission.description ?? null,
        isProtected: permission.isProtected,
      },
      {
        id,
        key: permission.key,
        description:
          dto.description !== undefined ? dto.description : (permission.description ?? null),
        isProtected,
      },
      (tx) =>
        tx.permission.update({
          where: { id },
          data: {
            description: dto.description,
            ...(actor.isSystem && dto.isProtected !== undefined
              ? { isProtected: dto.isProtected }
              : {}),
          },
          include: { roles: { include: { role: true } } },
        }),
    );
    return this.view(updated);
  }

  async remove(id: string, actor: Principal) {
    const permission = await this.prisma.permission.findUnique({ where: { id } });
    if (!permission) throw new NotFoundException('Permission tidak ditemukan');
    if ((permission.isProtected || isProtectedPermissionKey(permission.key)) && !actor.isSystem) {
      throw new ForbiddenException('Permission sistem tidak boleh dihapus');
    }

    const [roles, menus, capabilities] = await Promise.all([
      this.prisma.rolePermission.count({ where: { permissionsId: id } }),
      this.prisma.menuPermission.count({ where: { permissionId: id } }),
      this.prisma.adminCapability.count({ where: { permissionId: id } }),
    ]);
    if (roles + menus + capabilities > 0) {
      throw new ConflictException('Permission masih dipakai dan tidak bisa dihapus');
    }
    await this.mutate(
      actor,
      'permission.delete',
      id,
      { id, key: permission.key, isProtected: permission.isProtected },
      null,
      (tx) => tx.permission.delete({ where: { id } }),
    );
    return { message: 'Permission dihapus' };
  }

  async drift() {
    const dbKeys = new Set(
      (await this.prisma.permission.findMany({ select: { key: true } })).map((p) => p.key),
    );
    const policyPermissions = new Set(Object.values(POLICIES).map((p) => p.permission));

    const orphan = [...dbKeys].filter((key) => !policyPermissions.has(key)).sort();
    const unregistered = Object.entries(POLICIES)
      .filter(([, policy]) => !dbKeys.has(policy.permission))
      .map(([route]) => route)
      .sort();

    return { orphan, unregistered };
  }
}
