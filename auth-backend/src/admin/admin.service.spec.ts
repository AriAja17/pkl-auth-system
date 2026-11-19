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
  let audit: any;
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
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new AdminService(prisma as unknown as PrismaService, audit);
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

  it('rejects a duplicate email with the same conflict response as register', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow({ email: 'taken@example.com' }));

    const attempt = service.createUser(
      { email: 'taken@example.com', password: 'secret123', username: 'newuser' },
      actor(),
    );
    await expect(attempt).rejects.toBeInstanceOf(ConflictException);
    await expect(attempt).rejects.toThrow('Email sudah terdaftar');
    expect(prisma.user.create).not.toHaveBeenCalled();
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

  it('prevents updating own account (including self-deactivation)', async () => {
    await expect(
      service.updateUser('actor-1', { isActive: false }, actor()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.user.update).not.toHaveBeenCalled();

    prisma.user.findUnique.mockResolvedValue(userRow());
    await service.updateUser('user-1', { isActive: false }, actor());
    expect(prisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'user-1' },
        data: expect.objectContaining({ isActive: false }),
      }),
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

  it('legacy assignRole rejects a role whose permissions exceed actor capability', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([
      {
        id: 'role-danger',
        name: 'Danger',
        isSystem: false,
        permissions: [{ permission: { key: 'delete:user' } }],
      },
    ]);
    const limited = actor({
      isSystem: false,
      permissions: new Set(['read:user', 'delete:user']),
      capabilities: new Set(['read:user']),
    });

    await expect(service.assignRole('user-1', 'role-danger', limited)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('legacy assignRole keeps superadmin protection and self-assignment guard', async () => {
    // Self-assignment is rejected before any lookup or write.
    await expect(service.assignRole('actor-1', 'role-a', actor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prisma.user.findUnique.mockResolvedValue(
      userRow({
        roles: [{ role: { id: 'r-sys', name: 'superadmin', isSystem: true } }],
      }),
    );
    await expect(service.assignRole('user-1', 'role-a', actor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );

    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([
      { id: 'r-sys', name: 'superadmin', isSystem: true, permissions: [] },
    ]);
    await expect(service.assignRole('user-1', 'r-sys', actor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('superadmin can still assign a non-system role holding a protected permission', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([
      {
        id: 'role-a',
        name: 'Editor',
        isSystem: false,
        permissions: [{ permission: { key: 'manage:user', isProtected: true } }],
      },
    ]);

    const result = await service.assignRole('user-1', 'role-a', actor());

    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { legacyRoleId: 'role-a' },
    });
    expect(result).toEqual({ userId: 'user-1', role: 'Editor' });
  });

  it('rejects isProtected permissions even when the actor has permission and capability', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([
      {
        id: 'role-protected',
        name: 'Protected',
        isSystem: false,
        permissions: [{ permission: { key: 'delete:role', isProtected: true } }],
      },
    ]);
    const limited = actor({
      isSystem: false,
      permissions: new Set(['delete:role']),
      capabilities: new Set(['delete:role']),
    });

    const attempt = service.assignRole('user-1', 'role-protected', limited);
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toThrow('hanya untuk superadmin');
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('rejects a protected key even when the database isProtected flag is false', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([
      {
        id: 'role-key',
        name: 'Grant',
        isSystem: false,
        permissions: [{ permission: { key: 'grant:admin', isProtected: false } }],
      },
    ]);
    const limited = actor({
      isSystem: false,
      permissions: new Set(['grant:admin']),
      capabilities: new Set(['grant:admin']),
    });

    const attempt = service.addUserRole('user-1', 'role-key', limited);
    await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
    await expect(attempt).rejects.toThrow('hanya untuk superadmin');
    expect(prisma.userRole.create).not.toHaveBeenCalled();
  });

  it('still assigns a normal role within permission and capability for non-superadmin', async () => {
    const normalRole = {
      id: 'role-normal',
      name: 'Editor',
      isSystem: false,
      permissions: [{ permission: { key: 'read:user', isProtected: false } }],
    };
    const limited = actor({
      isSystem: false,
      permissions: new Set(['read:user']),
      capabilities: new Set(['read:user']),
    });
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([normalRole]);

    await expect(service.assignRole('user-1', 'role-normal', limited)).resolves.toEqual({
      userId: 'user-1',
      role: 'Editor',
    });
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      data: { legacyRoleId: 'role-normal' },
    });

    await expect(service.addUserRole('user-1', 'role-normal', limited)).resolves.toEqual({
      userId: 'user-1',
      role: 'Editor',
    });
    expect(prisma.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roleId: 'role-normal' },
    });
  });

  it('multi-role assignment keeps its capability boundary and UserRole write', async () => {
    prisma.user.findUnique.mockResolvedValue(userRow());
    prisma.role.findMany.mockResolvedValue([
      {
        id: 'role-danger',
        name: 'Danger',
        isSystem: false,
        permissions: [{ permission: { key: 'delete:user' } }],
      },
    ]);
    const limited = actor({
      isSystem: false,
      permissions: new Set(['delete:user']),
      capabilities: new Set(['read:user']),
    });
    await expect(
      service.addUserRole('user-1', 'role-danger', limited),
    ).rejects.toBeInstanceOf(ForbiddenException);
    expect(prisma.userRole.create).not.toHaveBeenCalled();

    prisma.role.findMany.mockResolvedValue([
      { id: 'role-ok', name: 'Editor', isSystem: false, permissions: [] },
    ]);
    await expect(service.addUserRole('user-1', 'role-ok', actor())).resolves.toEqual({
      userId: 'user-1',
      role: 'Editor',
    });
    expect(prisma.userRole.create).toHaveBeenCalledWith({
      data: { userId: 'user-1', roleId: 'role-ok' },
    });
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

  it('audits createUser with the database user id, not the email', async () => {
    prisma.user.create.mockImplementation(async ({ data }: any) =>
      userRow({ id: 'user-generated-id', ...data }),
    );

    await service.createUser(
      { email: 'new@example.com', password: 'secret123', username: 'newuser' },
      actor(),
    );

    const entry = audit.record.mock.calls[0][0];
    expect(entry.action).toBe('user.create');
    expect(entry.resourceId).toBe('user-generated-id');
    expect(entry.resourceId).not.toBe('new@example.com');
    expect(entry.before).toBeNull();
    expect(entry.after).toMatchObject({
      id: 'user-generated-id',
      email: 'new@example.com',
      username: 'newuser',
    });
  });

  it('audits createRole with the database role id, not the name', async () => {
    prisma.role.create.mockImplementation(async ({ data }: any) => ({
      id: 'role-generated-id',
      ...data,
      permissions: [],
      _count: { users: 0 },
    }));

    await service.createRole({ name: 'Editor' }, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.action).toBe('role.create');
    expect(entry.resourceId).toBe('role-generated-id');
    expect(entry.resourceId).not.toBe('Editor');
    expect(entry.after).toMatchObject({ id: 'role-generated-id', name: 'Editor' });
  });

  it('keeps name and phone in the PATCH user audit when only isActive is sent', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userRow({ name: 'Old Name', phone: '1234567890', isActive: true }),
    );

    await service.updateUser('user-1', { isActive: false }, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.before).toMatchObject({
      name: 'Old Name',
      phone: '1234567890',
      isActive: true,
    });
    expect(entry.after).toMatchObject({
      id: 'user-1',
      name: 'Old Name',
      phone: '1234567890',
      isActive: false,
    });
  });

  it('keeps description in the PATCH role audit when it is not sent', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'r2',
      name: 'Editor',
      description: 'Old description',
      isSystem: false,
    });

    await service.updateRole('r2', { name: 'Renamed' }, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.before).toMatchObject({ description: 'Old description' });
    expect(entry.after).toMatchObject({
      id: 'r2',
      name: 'Renamed',
      description: 'Old description',
    });
  });

  it('audits the previous and next permission keys on role permission change', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'r2',
      name: 'Editor',
      isSystem: false,
      permissions: [
        { permission: { key: 'read:user' } },
        { permission: { key: 'create:user' } },
      ],
    });
    prisma.permission.findMany.mockResolvedValue([
      { id: 'p3', key: 'update:user', isProtected: false },
    ]);

    await service.setRolePermissions('r2', { permissionKeys: ['update:user'] }, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.before.permissionKeys).toEqual(['create:user', 'read:user']);
    expect(entry.after).toMatchObject({ id: 'r2', permissionKeys: ['update:user'] });
  });

  it('records explicit null name and phone in the PATCH user audit', async () => {
    prisma.user.findUnique.mockResolvedValue(
      userRow({ name: 'Old Name', phone: '1234567890' }),
    );

    await service.updateUser('user-1', { name: null, phone: null } as any, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.before).toMatchObject({ name: 'Old Name', phone: '1234567890' });
    expect(entry.after).toMatchObject({ name: null, phone: null });
  });

  it('records explicit null description in the PATCH role audit', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'r2',
      name: 'Editor',
      description: 'Old description',
      isSystem: false,
    });

    await service.updateRole('r2', { description: null } as any, actor());

    const entry = audit.record.mock.calls[0][0];
    expect(entry.before.description).toBe('Old description');
    expect(entry.after).toMatchObject({ name: 'Editor', description: null });
  });

  it('deduplicates permission keys in the createRole audit snapshot', async () => {
    prisma.permission.findMany.mockResolvedValue([
      { id: 'p1', key: 'read:user', isProtected: false },
      { id: 'p2', key: 'create:user', isProtected: false },
    ]);
    prisma.role.create.mockImplementation(async ({ data }: any) => ({
      id: 'role-generated-id',
      ...data,
      permissions: [],
      _count: { users: 0 },
    }));

    await service.createRole(
      { name: 'Editor', permissionKeys: ['read:user', 'create:user', 'read:user'] },
      actor(),
    );

    const entry = audit.record.mock.calls[0][0];
    expect(entry.after.permissionKeys).toEqual(['read:user', 'create:user']);
    expect(new Set(entry.after.permissionKeys).size).toBe(entry.after.permissionKeys.length);
  });

  it('deduplicates and sorts permission keys in the setRolePermissions audit snapshot', async () => {
    prisma.role.findUnique.mockResolvedValue({
      id: 'r2',
      name: 'Editor',
      isSystem: false,
      permissions: [],
    });
    prisma.permission.findMany.mockResolvedValue([
      { id: 'p1', key: 'read:user', isProtected: false },
      { id: 'p2', key: 'create:user', isProtected: false },
    ]);

    await service.setRolePermissions(
      'r2',
      { permissionKeys: ['read:user', 'create:user', 'read:user'] },
      actor(),
    );

    const entry = audit.record.mock.calls[0][0];
    expect(entry.after.permissionKeys).toEqual(['create:user', 'read:user']);
  });
});
