import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PROTECTED_ROLE = 'Admin';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ---------- Lihat data ----------

  listUsers() {
    return this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions.map((rp) => rp.permission.key),
    }));
  }

  listPermissions() {
    return this.prisma.permission.findMany();
  }

  // ---------- Kelola role ----------

  async createRole(name: string) {
    const existing = await this.prisma.role.findUnique({ where: { name } });
    if (existing) {
      throw new ConflictException('Nama role sudah dipakai');
    }
    return this.prisma.role.create({ data: { name } });
  }

  async setRolePermissions(roleId: string, keys: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }
    if (role.name === PROTECTED_ROLE) {
      throw new ForbiddenException('Role Admin tidak boleh diubah');
    }

    const uniqueKeys = [...new Set(keys)];
    const permissions = await this.prisma.permission.findMany({
      where: { key: { in: uniqueKeys } },
    });

    if (permissions.length !== uniqueKeys.length) {
      const found = permissions.map((p) => p.key);
      const unknown = uniqueKeys.filter((k) => !found.includes(k));
      throw new BadRequestException(
        `Permission tidak dikenal: ${unknown.join(', ')}`,
      );
    }

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionsId: p.id })),
      }),
    ]);

    return { id: role.id, name: role.name, permissions: uniqueKeys };
  }

  async deleteRole(roleId: string) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }
    if (role.name === PROTECTED_ROLE) {
      throw new ForbiddenException('Role Admin tidak boleh dihapus');
    }

    const userCount = await this.prisma.user.count({ where: { roleId } });
    if (userCount > 0) {
      throw new ConflictException(
        `Role masih dipakai ${userCount} user, cabut dulu rolenya`,
      );
    }

    await this.prisma.role.delete({ where: { id: roleId } });
    return { message: 'Role dihapus' };
  }

  // ---------- Kelola role milik user ----------

  async assignRole(userId: string, roleId: string, actorId: string) {
    if (userId === actorId) {
      throw new ForbiddenException('Tidak boleh mengubah role sendiri');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }

    await this.prisma.user.update({ where: { id: userId }, data: { roleId } });
    return { userId, role: role.name };
  }

  async revokeRole(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new ForbiddenException('Tidak boleh mengubah role sendiri');
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: null },
    });
    return { userId, role: null };
  }
}