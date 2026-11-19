import {
  ConflictException,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import * as bcrypt from 'bcryptjs';
import { AdminService } from './admin.service';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../authorization/principal';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { AuthorizationService } from '../authorization/authorization.service';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';

const actor = (overrides: Partial<Principal> = {}): Principal => ({
  id: 'actor-1',
  email: 'actor@example.com',
  username: 'actor',
  isActive: true,
  roles: [{ id: 'role-superadmin', name: 'superadmin', isSystem: true }],
  permissions: new Set(['manage:user', 'read:user', 'create:user', 'update:user']),
  capabilities: new Set(['read:article']),
  isSystem: true,
  legacyRoleName: null,
  legacyPermissions: [],
  ...overrides,
});

const userRow = (overrides: Record<string, unknown> = {}) => ({
  id: 'user-1',
  email: 'user@example.com',
  username: 'user',
  password: 'hashed-secret',
  name: null,
  phone: null,
  isActive: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  roles: [],
  legacyRole: null,
  ...overrides,
});

describe('AdminService — user & role management', () => {
  let prisma: any;
  let service: AdminService;

  beforeEach(() => {
    prisma = {
      user: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }: any) => userRow(data)),
        update: jest.fn().mockImplementation(async ({ data }: any) => userRow(data)),
        delete: jest.fn().mockResolvedValue({}),
      },
      role: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'role-1',
          ...data,
          permissions: [],
          _count: { users: 0 },
        })),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'role-1',
          ...data,
          permissions: [],
          _count: { users: 0 },
        })),
        delete: jest.fn().mockResolvedValue({}),
      },
      userRole: {
        findUnique: jest.fn().mockResolvedValue(null),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
        create: jest.fn().mockResolvedValue({}),
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      rolePermission: {
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      permission: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      $transaction: jest.fn(async (arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
    };
    service = new AdminService(prisma as unknown as PrismaService);
  });

  it('creates a user with hashed password and multiple roles, without leaking the hash', async () => {
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-a', name: 'Editor', isSystem: false, permissions: [] },
      { id: 'role-b', name: 'Penulis', isSystem: false, permissions: [] },
    ]);
    prisma.user.create.mockImplementation(async ({ data }: any) => userRow(data));

    const result: any = await service.createUser(
      {
        email: 'new@example.com',
        password: 'secret123',
        username: 'newuser',
        roleIds: ['role-a', 'role-b'],
      },
      actor(),
    );

    const created = prisma.user.create.mock.calls[0][0].data;
    expect(await bcrypt.compare('secret123', created.password)).toBe(true);
    expect(created.roles.create).toHaveLength(2);
    expect(result).not.toHaveProperty('password');
    expect(result.roles).toHaveLength(2);
  });

  it('rejects a duplicate username case-insensitively', async () => {
    prisma.user.findMany.mockResolvedValue([{ id: 'other', username: 'ADMIN' }]);
    await expect(
      service.createUser(
        { email: 'x@example.com', password: 'secret123', username: 'admin' },
        actor(),
      ),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns paginated sanitized user listings', async () => {
    prisma.user.findMany.mockResolvedValue([userRow()]);
    prisma.user.count.mockResolvedValue(1);
    const result = await service.listUsers({ page: 1, limit: 10 });
    expect(result.total).toBe(1);
    expect(result.items[0]).not.toHaveProperty('password');
  });

  it('prevents self-deletion and deletion of system users', async () => {
    await expect(service.deleteUser('actor-1', actor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    prisma.user.findUnique.mockResolvedValue(
      userRow({
        roles: [{ role: { id: 'r', name: 'superadmin', isSystem: true } }],
      }),
    );
    await expect(service.deleteUser('user-1', actor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('replaces roles through UserRole inside a transaction', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([
      { id: 'role-a', name: 'Editor', isSystem: false, permissions: [] },
    ]);
    await service.replaceUserRoles('user-1', { roleIds: ['role-a'] }, actor());
    expect(prisma.userRole.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-1' } });
    expect(prisma.userRole.createMany).toHaveBeenCalledWith({
      data: [{ userId: 'user-1', roleId: 'role-a' }],
    });
  });

  it('refuses to assign or remove the system role', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([
      { id: 'r-sys', name: 'superadmin', isSystem: true, permissions: [] },
    ]);
    await expect(
      service.addUserRole('user-1', 'r-sys', actor()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.role.findUnique.mockResolvedValue({ id: 'r-sys', name: 'superadmin', isSystem: true });
    await expect(
      service.removeUserRole('user-1', 'r-sys', actor()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces delegated boundaries when creating a role', async () => {
    prisma.permission.findMany.mockResolvedValue([
      { id: 'p1', key: 'read:article', isProtected: false },
    ]);
    const limited = actor({
      isSystem: false,
      roles: [{ id: 'r', name: 'Editor', isSystem: false }],
      permissions: new Set(['read:article']),
      capabilities: new Set(),
    });
    await expect(
      service.createRole({ name: 'Viewer', permissionKeys: ['read:article'] }, limited),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('protects system roles and own role from permission changes', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r1', name: 'superadmin', isSystem: true });
    await expect(
      service.setRolePermissions('r1', { permissionKeys: [] }, actor()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.role.findUnique.mockResolvedValue({ id: 'r2', name: 'Editor', isSystem: false });
    await expect(
      service.setRolePermissions(
        'r2',
        { permissionKeys: [] },
        actor({ roles: [{ id: 'r2', name: 'Editor', isSystem: false }] }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('sets role permissions transactionally with canonical keys', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r2', name: 'Editor', isSystem: false });
    prisma.permission.findMany.mockResolvedValue([
      { id: 'p1', key: 'read:article', isProtected: false },
    ]);
    await service.setRolePermissions('r2', { permissionKeys: ['read:article'] }, actor());
    expect(prisma.rolePermission.deleteMany).toHaveBeenCalledWith({ where: { roleId: 'r2' } });
    expect(prisma.rolePermission.createMany).toHaveBeenCalledWith({
      data: [{ roleId: 'r2', permissionsId: 'p1' }],
    });
  });

  it('refuses to delete a role that is still assigned', async () => {
    prisma.role.findUnique.mockResolvedValue({ id: 'r2', name: 'Editor', isSystem: false });
    prisma.userRole.count.mockResolvedValue(2);
    await expect(service.deleteRole('r2', actor())).rejects.toBeInstanceOf(ConflictException);
  });

  it('denies granular endpoints without the canonical permission', () => {
    const authorization = new AuthorizationService(prisma as unknown as PrismaService);
    const guard = new PermissionsGuard(new Reflector(), authorization);
    class Handler {
      @RequirePermissions('create:user')
      create() {}
    }
    const context = {
      getHandler: () => Handler.prototype.create,
      getClass: () => Handler,
      switchToHttp: () => ({
        getRequest: () => ({
          user: actor({ permissions: new Set(['manage:user']) }),
        }),
      }),
    } as unknown as ExecutionContext;
    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });
});
