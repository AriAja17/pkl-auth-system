import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PROTECTED_ROLE = 'Admin';
const PROTECTED_PERMISSION = 'user.manage';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  // ---------- Lihat data (selalu diurutkan supaya tampilan stabil) ----------

  listUsers() {
    return this.prisma.user.findMany({
      orderBy: { email: 'asc' },
      select: {
        id: true,
        email: true,
        role: { select: { id: true, name: true } },
      },
    });
  }

  async listRoles() {
    const roles = await this.prisma.role.findMany({
      orderBy: { name: 'asc' },
      include: { permissions: { include: { permission: true } } },
    });
    return roles.map((r) => ({
      id: r.id,
      name: r.name,
      permissions: r.permissions.map((rp) => rp.permission.key).sort(),
    }));
  }

  listPermissions() {
    return this.prisma.permission.findMany({ orderBy: { key: 'asc' } });
  }

  // ---------- Pembantu: cek daftar permission ----------

  private async resolvePermissions(keys: string[]) {
    const uniqueKeys = [...new Set(keys)];

    if (uniqueKeys.includes(PROTECTED_PERMISSION)) {
      throw new ForbiddenException(
        `Permission ${PROTECTED_PERMISSION} hanya untuk role ${PROTECTED_ROLE}`,
      );
    }

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

    return permissions;
  }

  // ---------- Kelola role ----------

  async createRole(name: string, keys: string[] = []) {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new BadRequestException('Nama role wajib diisi');
    }
    if (trimmed.toLowerCase() === PROTECTED_ROLE.toLowerCase()) {
      throw new ConflictException('Nama role sudah dipakai');
    }

    const existing = await this.prisma.role.findUnique({
      where: { name: trimmed },
    });
    if (existing) {
      throw new ConflictException('Nama role sudah dipakai');
    }

    const permissions = await this.resolvePermissions(keys);

    const role = await this.prisma.role.create({
      data: {
        name: trimmed,
        permissions: {
          create: permissions.map((p) => ({
            permission: { connect: { id: p.id } },
          })),
        },
      },
    });

    return {
      id: role.id,
      name: role.name,
      permissions: permissions.map((p) => p.key),
    };
  }

  async setRolePermissions(roleId: string, keys: string[]) {
    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }
    if (role.name === PROTECTED_ROLE) {
      throw new ForbiddenException('Role Admin tidak boleh diubah');
    }

    const permissions = await this.resolvePermissions(keys);

    await this.prisma.$transaction([
      this.prisma.rolePermission.deleteMany({ where: { roleId } }),
      this.prisma.rolePermission.createMany({
        data: permissions.map((p) => ({ roleId, permissionsId: p.id })),
      }),
    ]);

    return {
      id: role.id,
      name: role.name,
      permissions: permissions.map((p) => p.key),
    };
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

  // ---------- Kelola user ----------

  async assignRole(userId: string, roleId: string, actorId: string) {
    if (userId === actorId) {
      throw new ForbiddenException('Tidak boleh mengubah role sendiri');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    if (user.role?.name === PROTECTED_ROLE) {
      throw new ForbiddenException('Role user Admin tidak bisa diubah');
    }

    const role = await this.prisma.role.findUnique({ where: { id: roleId } });
    if (!role) {
      throw new NotFoundException('Role tidak ditemukan');
    }
    if (role.name === PROTECTED_ROLE) {
      throw new ForbiddenException(
        'Role Admin tidak bisa diberikan ke user lain',
      );
    }

    await this.prisma.user.update({ where: { id: userId }, data: { roleId } });
    return { userId, role: role.name };
  }

  async revokeRole(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new ForbiddenException('Tidak boleh mengubah role sendiri');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    if (user.role?.name === PROTECTED_ROLE) {
      throw new ForbiddenException('Role user Admin tidak bisa diubah');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { roleId: null },
    });
    return { userId, role: null };
  }

  async deleteUser(userId: string, actorId: string) {
    if (userId === actorId) {
      throw new ForbiddenException('Tidak boleh menghapus akun sendiri');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { role: true },
    });
    if (!user) {
      throw new NotFoundException('User tidak ditemukan');
    }
    if (user.role?.name === PROTECTED_ROLE) {
      throw new ForbiddenException('User Admin tidak bisa dihapus');
    }

    await this.prisma.user.delete({ where: { id: userId } });
    return { message: 'User dihapus' };
  }
}