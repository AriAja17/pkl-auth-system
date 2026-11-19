import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService, auditActor } from '../audit/audit.service';
import { SYSTEM_ROLE_NAME, isProtectedPermissionKey } from '../authorization/constants';
import { Principal } from '../authorization/principal';
import { PERMISSION_KEY_PATTERN } from '../common/validation/rules';
import { USERNAME_PATTERN, usernameFor } from '../auth/utils/username';
import { SearchQueryDto } from '../common/dto/pagination.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRolesDto } from './dto/user-roles.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';

@Injectable()
export class AdminService {
  constructor(
    private prisma: PrismaService,
    @Optional() private audit?: AuditService,
  ) {}

  /** Mutation + AuditLog row inside one transaction. */
  private async mutate<T>(
    actor: Principal | undefined,
    action: string,
    resourceType: string,
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
          resourceType,
          resourceId,
          before,
          after,
        },
        tx,
      );
      return result;
    });
  }

  private userSnapshot(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name ?? null,
      phone: user.phone ?? null,
      isActive: user.isActive,
      roleIds: (user.roles ?? []).map((assignment: any) => assignment.role.id),
    };
  }

  // ---------- Pembantu umum ----------

  private isSystemRole(role: { name: string; isSystem: boolean }): boolean {
    return role.isSystem || role.name === SYSTEM_ROLE_NAME;
  }

  private assertNotSelf(userId: string, actor: Principal): void {
    if (userId === actor.id) {
      throw new ForbiddenException('Tidak boleh mengubah akun sendiri');
    }
  }

  private hasSystemRole(user: any): boolean {
    const roles = (user.roles ?? []).map((assignment: any) => assignment.role);
    if (roles.some((role: any) => this.isSystemRole(role))) return true;
    return Boolean(user.legacyRole && this.isSystemRole(user.legacyRole));
  }

  private async loadUser(id: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: { roles: { include: { role: true } }, legacyRole: true },
    });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    return user;
  }

  private userView(user: any) {
    return {
      id: user.id,
      email: user.email,
      username: user.username,
      name: user.name ?? null,
      phone: user.phone ?? null,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: (user.roles ?? [])
        .map((a: any) => ({
          id: a.role.id,
          name: a.role.name,
          isSystem: a.role.isSystem,
        }))
        .sort((a: any, b: any) => a.name.localeCompare(b.name)),
      legacyRole: user.legacyRole
        ? { id: user.legacyRole.id, name: user.legacyRole.name }
        : null,
    };
  }

  private roleView(role: any) {
    return {
      id: role.id,
      name: role.name,
      description: role.description ?? null,
      isSystem: role.isSystem,
      permissions: (role.permissions ?? [])
        .map((rp: any) => rp.permission.key)
        .sort(),
      usersCount: role._count?.users ?? 0,
      createdAt: role.createdAt,
    };
  }

  private async assertUsernameAvailable(username: string, excludeId?: string) {
    if (!USERNAME_PATTERN.test(username)) {
      throw new BadRequestException('Username harus [a-z0-9_]{3,30}');
    }
    const users = await this.prisma.user.findMany({
      select: { id: true, username: true },
    });
    if (
      users.some(
        (u) => u.id !== excludeId && u.username?.toLowerCase() === username.toLowerCase(),
      )
    ) {
      throw new ConflictException('Username sudah terdaftar');
    }
  }

  /** Validates canonical keys and delegated boundaries (doc 05 §7.2 rule 5). */
  private async resolvePermissions(keys: string[], actor: Principal): Promise<any[]> {
    const uniqueKeys = [...new Set(keys)];
    for (const key of uniqueKeys) {
      if (!PERMISSION_KEY_PATTERN.test(key)) {
        throw new BadRequestException('Permission key harus berformat action:resource');
      }
    }

    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: uniqueKeys } },
    });
    if (permissions.length !== uniqueKeys.length) {
      const found = permissions.map((p: any) => p.key);
      const unknown = uniqueKeys.filter((k) => !found.includes(k));
      throw new BadRequestException(`Permission tidak dikenal: ${unknown.join(', ')}`);
    }

    for (const permission of permissions as any[]) {
      if (
        !actor.isSystem &&
        (permission.isProtected || isProtectedPermissionKey(permission.key))
      ) {
        throw new ForbiddenException(
          `Permission ${permission.key} hanya untuk ${SYSTEM_ROLE_NAME}`,
        );
      }
      if (
        !actor.isSystem &&
        (!actor.permissions.has(permission.key) || !actor.capabilities.has(permission.key))
      ) {
        throw new ForbiddenException(
          `Permission ${permission.key} di luar batas capability actor`,
        );
      }
    }
    return permissions;
  }

  /** Role assignment must stay inside the actor's permission + capability set. */
  private async assertRolesAssignable(roleIds: string[], actor: Principal): Promise<any[]> {
    const uniqueIds = [...new Set(roleIds)];
    const roles = await this.prisma.role.findMany({
      where: { id: { in: uniqueIds } },
      include: { permissions: { include: { permission: true } } },
    });
    if (roles.length !== uniqueIds.length) {
      throw new BadRequestException('Role tidak dikenal');
    }
    for (const role of roles as any[]) {
      if (this.isSystemRole(role)) {
        throw new ForbiddenException('Role sistem tidak bisa diassign via API');
      }
      if (!actor.isSystem) {
        for (const rp of role.permissions) {
          const permission = rp.permission;
          const key = permission.key;
          if (permission.isProtected || isProtectedPermissionKey(key)) {
            throw new ForbiddenException(
              `Permission ${key} hanya untuk ${SYSTEM_ROLE_NAME}`,
            );
          }
          if (!actor.permissions.has(key) || !actor.capabilities.has(key)) {
            throw new ForbiddenException(`Role memuat permission di luar capability: ${key}`);
          }
        }
      }
    }
    return roles;
  }

  // ---------- User management ----------

  async listUsers(query: SearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = query.search
      ? {
          OR: [
            { email: { contains: query.search, mode: 'insensitive' as const } },
            { username: { contains: query.search, mode: 'insensitive' as const } },
            { name: { contains: query.search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        orderBy: { email: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { roles: { include: { role: true } }, legacyRole: true },
      }),
      this.prisma.user.count({ where }),
    ]);

    return { items: items.map((u: any) => this.userView(u)), total, page, limit };
  }

  async getUser(id: string) {
    return this.userView(await this.loadUser(id));
  }

  async createUser(dto: CreateUserDto, actor: Principal) {
    if (dto.password.length < 6) {
      throw new BadRequestException('Password minimal 6 karakter');
    }
    const used = new Set(
      (await this.prisma.user.findMany({ select: { username: true } }))
        .map((u) => u.username?.toLowerCase())
        .filter((value): value is string => Boolean(value)),
    );
    const username = (dto.username ? dto.username : usernameFor(dto.email, used)).toLowerCase();
    await this.assertUsernameAvailable(username);

    const roles = dto.roleIds?.length
      ? await this.assertRolesAssignable(dto.roleIds, actor)
      : [];
    const hashed = await bcrypt.hash(dto.password, 10);

    const created = await this.mutate<any>(
      actor,
      'user.create',
      'user',
      dto.email,
      null,
      {
        email: dto.email,
        username,
        name: dto.name ?? null,
        phone: dto.phone ?? null,
        roleIds: roles.map((role: any) => role.id),
      },
      (tx) =>
        tx.user.create({
          data: {
            email: dto.email,
            password: hashed,
            username,
            name: dto.name,
            phone: dto.phone,
            roles: {
              create: roles.map((role: any) => ({
                role: { connect: { id: role.id } },
              })),
            },
          },
        }),
    );

    return {
      id: created.id,
      email: created.email,
      username: created.username,
      name: created.name ?? null,
      phone: created.phone ?? null,
      isActive: created.isActive,
      roles: roles.map((role: any) => ({
        id: role.id,
        name: role.name,
        isSystem: role.isSystem,
      })),
    };
  }

  async updateUser(id: string, dto: UpdateUserDto, actor: Principal) {
    this.assertNotSelf(id, actor);
    const user = await this.loadUser(id);
    if (this.hasSystemRole(user)) {
      throw new ForbiddenException('User sistem tidak bisa diubah via API');
    }
    const updated = await this.mutate(
      actor,
      'user.update',
      'user',
      id,
      this.userSnapshot(user),
      { id, name: dto.name ?? null, phone: dto.phone ?? null, isActive: dto.isActive ?? user.isActive },
      (tx) =>
        tx.user.update({
          where: { id },
          data: { name: dto.name, phone: dto.phone, isActive: dto.isActive },
          include: { roles: { include: { role: true } }, legacyRole: true },
        }),
    );
    return this.userView(updated);
  }

  async deleteUser(id: string, actor: Principal) {
    this.assertNotSelf(id, actor);
    const user = await this.loadUser(id);
    if (this.hasSystemRole(user)) {
      throw new ForbiddenException('User sistem tidak bisa dihapus');
    }
    await this.mutate(
      actor,
      'user.delete',
      'user',
      id,
      this.userSnapshot(user),
      null,
      async (tx) => {
        await tx.userRole.deleteMany({ where: { userId: id } });
        await tx.user.delete({ where: { id } });
      },
    );
    return { message: 'User dihapus' };
  }

  async replaceUserRoles(userId: string, dto: UserRolesDto, actor: Principal) {
    this.assertNotSelf(userId, actor);
    const user = await this.loadUser(userId);
    if (this.hasSystemRole(user)) {
      throw new ForbiddenException('Role user sistem tidak bisa diubah');
    }
    const roles = await this.assertRolesAssignable(dto.roleIds, actor);
    await this.mutate(
      actor,
      'user.roles.replace',
      'user',
      userId,
      this.userSnapshot(user),
      { userId, roleIds: roles.map((role: any) => role.id) },
      async (tx) => {
        await tx.userRole.deleteMany({ where: { userId } });
        if (roles.length > 0) {
          await tx.userRole.createMany({
            data: roles.map((role: any) => ({ userId, roleId: role.id })),
          });
        }
      },
    );
    return {
      userId,
      roles: roles.map((role: any) => ({ id: role.id, name: role.name })),
    };
  }

  async addUserRole(userId: string, roleId: string, actor: Principal) {
    this.assertNotSelf(userId, actor);
    const user = await this.loadUser(userId);
    if (this.hasSystemRole(user)) {
      throw new ForbiddenException('Role user sistem tidak bisa diubah');
    }
    const [role] = await this.assertRolesAssignable([roleId], actor);
    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (existing) throw new ConflictException('Role sudah diberikan ke user');
    await this.mutate(
      actor,
      'user.roles.assign',
      'user',
      userId,
      this.userSnapshot(user),
      { userId, roleIds: [roleId] },
      (tx) => tx.userRole.create({ data: { userId, roleId } }),
    );
    return { userId, role: role.name };
  }

  async removeUserRole(userId: string, roleId: string, actor: Principal) {
    this.assertNotSelf(userId, actor);
    const user = await this.loadUser(userId);
    if (this.hasSystemRole(user)) {
      throw new ForbiddenException('Role user sistem tidak bisa diubah');
    }
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role tidak ditemukan');
    if (this.isSystemRole(role)) {
      throw new ForbiddenException('Role sistem tidak bisa dicabut via API');
    }
    const existing = await this.prisma.userRole.findUnique({
      where: { userId_roleId: { userId, roleId } },
    });
    if (!existing) throw new NotFoundException('Assignment tidak ditemukan');
    await this.mutate(
      actor,
      'user.roles.revoke',
      'user',
      userId,
      this.userSnapshot(user),
      { userId, removedRoleId: roleId },
      (tx) => tx.userRole.delete({ where: { userId_roleId: { userId, roleId } } }),
    );
    return { userId, role: role.name, removed: true };
  }

  // ---------- Role management ----------

  async listRoles(query: SearchQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const where = query.search
      ? { name: { contains: query.search, mode: 'insensitive' as const } }
      : {};
    const [items, total] = await this.prisma.$transaction([
      this.prisma.role.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          permissions: { include: { permission: true } },
          _count: { select: { users: true } },
        },
      }),
      this.prisma.role.count({ where }),
    ]);
    return { items: items.map((r: any) => this.roleView(r)), total, page, limit };
  }

  async getRole(id: string) {
    const role = await this.prisma.role.findUnique({
      where: { id },
      include: {
        permissions: { include: { permission: true } },
        _count: { select: { users: true } },
      },
    });
    if (!role) throw new NotFoundException('Role tidak ditemukan');
    return this.roleView(role);
  }

  async createRole(dto: CreateRoleDto, actor: Principal) {
    const trimmed = dto.name.trim();
    if (!trimmed) throw new BadRequestException('Nama role wajib diisi');
    if (trimmed.toLowerCase() === SYSTEM_ROLE_NAME) {
      throw new ConflictException('Nama role sistem sudah dipakai');
    }
    if (await this.prisma.role.findUnique({ where: { name: trimmed } })) {
      throw new ConflictException('Nama role sudah dipakai');
    }

    const keys = dto.permissionKeys ?? dto.permissions ?? [];
    const permissions = await this.resolvePermissions(keys, actor);
    const role = await this.mutate(
      actor,
      'role.create',
      'role',
      trimmed,
      null,
      { name: trimmed, description: dto.description ?? null, permissionKeys: keys },
      (tx) =>
        tx.role.create({
          data: {
            name: trimmed,
            description: dto.description,
            permissions: {
              create: permissions.map((permission: any) => ({
                permission: { connect: { id: permission.id } },
              })),
            },
          },
          include: {
            permissions: { include: { permission: true } },
            _count: { select: { users: true } },
          },
        }),
    );
    return this.roleView(role);
  }

  async updateRole(id: string, dto: UpdateRoleDto, actor: Principal) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role tidak ditemukan');
    if (this.isSystemRole(role)) {
      throw new ForbiddenException('Role sistem tidak boleh diubah');
    }
    if (dto.name && dto.name.trim().toLowerCase() === SYSTEM_ROLE_NAME) {
      throw new ConflictException('Nama role sistem sudah dipakai');
    }
    if (dto.name) {
      const duplicate = await this.prisma.role.findUnique({ where: { name: dto.name.trim() } });
      if (duplicate && duplicate.id !== id) {
        throw new ConflictException('Nama role sudah dipakai');
      }
    }
    const updated = await this.mutate(
      actor,
      'role.update',
      'role',
      id,
      { id, name: role.name, description: role.description ?? null },
      { id, name: dto.name?.trim() ?? role.name, description: dto.description ?? null },
      (tx) =>
        tx.role.update({
          where: { id },
          data: { name: dto.name?.trim(), description: dto.description },
          include: {
            permissions: { include: { permission: true } },
            _count: { select: { users: true } },
          },
        }),
    );
    return this.roleView(updated);
  }

  async deleteRole(id: string, actor: Principal) {
    const role = await this.prisma.role.findUnique({ where: { id } });
    if (!role) throw new NotFoundException('Role tidak ditemukan');
    if (this.isSystemRole(role)) {
      throw new ForbiddenException('Role sistem tidak boleh dihapus');
    }
    const assigned = await this.prisma.userRole.count({ where: { roleId: id } });
    const legacy = await this.prisma.user.count({ where: { legacyRoleId: id } });
    if (assigned + legacy > 0) {
      throw new ConflictException('Role masih dipakai user, cabut dulu rolenya');
    }
    await this.mutate(
      actor,
      'role.delete',
      'role',
      id,
      { id, name: role.name, description: role.description ?? null },
      null,
      (tx) => tx.role.delete({ where: { id } }),
    );
    return { message: 'Role dihapus' };
  }

  async setRolePermissions(roleId: string, dto: SetPermissionsDto, actor: Principal) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) throw new NotFoundException('Role tidak ditemukan');
    if (this.isSystemRole(role)) {
      throw new ForbiddenException('Role sistem tidak boleh diubah');
    }
    if (actor.roles.some((r) => r.id === roleId)) {
      throw new ForbiddenException('Tidak boleh mengubah permission role yang Anda pegang');
    }

    const keys = dto.permissionKeys ?? dto.permissions ?? [];
    const permissions = await this.resolvePermissions(keys, actor);
    await this.mutate(
      actor,
      'role.permissions.update',
      'role',
      roleId,
      { id: roleId, name: role.name },
      { id: roleId, permissionKeys: keys },
      async (tx) => {
        await tx.rolePermission.deleteMany({ where: { roleId } });
        await tx.rolePermission.createMany({
          data: permissions.map((permission: any) => ({
            roleId,
            permissionsId: permission.id,
          })),
        });
      },
    );
    return this.getRole(roleId);
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  // ---------- Deprecated single-role aliases (legacy roleId) ----------

  async assignRole(userId: string, roleId: string, actor: Principal) {
    this.assertNotSelf(userId, actor);
    const user = await this.loadUser(userId);
    if (this.hasSystemRole(user)) {
      throw new ForbiddenException('Role user sistem tidak bisa diubah');
    }
    const [role] = await this.assertRolesAssignable([roleId], actor);
    await this.mutate(
      actor,
      'user.legacyRole.assign',
      'user',
      userId,
      { userId },
      { userId, roleId },
      (tx) => tx.user.update({ where: { id: userId }, data: { legacyRoleId: roleId } }),
    );
    return { userId, role: role.name };
  }

  async revokeRole(userId: string, actor: Principal) {
    this.assertNotSelf(userId, actor);
    const user = await this.loadUser(userId);
    if (this.hasSystemRole(user)) {
      throw new ForbiddenException('Role user sistem tidak bisa diubah');
    }
    await this.mutate(
      actor,
      'user.legacyRole.revoke',
      'user',
      userId,
      { userId },
      { userId, roleId: null },
      (tx) => tx.user.update({ where: { id: userId }, data: { legacyRoleId: null } }),
    );
    return { userId, role: null };
  }
}
