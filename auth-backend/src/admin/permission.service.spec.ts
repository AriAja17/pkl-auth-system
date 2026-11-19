import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PermissionService } from './permission.service';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../authorization/principal';

const superadmin = (): Principal => ({
  id: 'actor-1',
  email: 'admin@example.com',
  username: 'admin',
  isActive: true,
  roles: [{ id: 'r1', name: 'superadmin', isSystem: true }],
  permissions: new Set(['create:permission']),
  capabilities: new Set(),
  isSystem: true,
  legacyRoleName: null,
  legacyPermissions: [],
});

const limitedActor = (): Principal => ({
  ...superadmin(),
  isSystem: false,
  roles: [{ id: 'r2', name: 'Editor', isSystem: false }],
});

describe('PermissionService', () => {
  let prisma: any;
  let service: PermissionService;

  beforeEach(() => {
    prisma = {
      permission: {
        findUnique: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([]),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'p1',
          createdAt: new Date(),
          ...data,
        })),
        update: jest.fn().mockImplementation(async ({ data }: any) => ({
          id: 'p1',
          key: 'view:widget',
          isProtected: false,
          createdAt: new Date(),
          ...data,
          roles: [],
        })),
        delete: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      role: {
        findFirst: jest.fn().mockResolvedValue({ id: 'superadmin-id', name: 'superadmin' }),
      },
      rolePermission: {
        create: jest.fn().mockResolvedValue({}),
        count: jest.fn().mockResolvedValue(0),
      },
      menuPermission: { count: jest.fn().mockResolvedValue(0) },
      adminCapability: { count: jest.fn().mockResolvedValue(0) },
      $transaction: jest.fn(async (arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
    };
    service = new PermissionService(prisma as unknown as PrismaService);
  });

  it('creates a permission and assigns it to superadmin atomically', async () => {
    const result = await service.create({ key: 'view:widget' }, superadmin());
    expect(prisma.permission.create).toHaveBeenCalledWith({
      data: { key: 'view:widget', description: undefined, isProtected: false },
    });
    expect(prisma.rolePermission.create).toHaveBeenCalledWith({
      data: { roleId: 'superadmin-id', permissionsId: 'p1' },
    });
    expect(result.roles).toEqual(['superadmin']);
  });

  it('rejects invalid keys and duplicates', async () => {
    await expect(service.create({ key: 'view.widget' }, superadmin())).rejects.toBeInstanceOf(
      BadRequestException,
    );
    prisma.permission.findUnique.mockResolvedValue({ id: 'p0', key: 'view:widget' });
    await expect(service.create({ key: 'view:widget' }, superadmin())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('does not allow a non-superadmin to create a protected permission', async () => {
    await expect(
      service.create({ key: 'view:widget', isProtected: true }, limitedActor()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('protects protected permission from non-superadmin update and delete', async () => {
    prisma.permission.findUnique.mockResolvedValue({
      id: 'p1',
      key: 'manage:user',
      isProtected: true,
    });
    await expect(
      service.update('p1', { description: 'x' }, limitedActor()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.remove('p1', limitedActor())).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('refuses to delete a permission still referenced anywhere', async () => {
    prisma.permission.findUnique.mockResolvedValue({
      id: 'p1',
      key: 'view:widget',
      isProtected: false,
    });
    prisma.rolePermission.count.mockResolvedValue(1);
    await expect(service.remove('p1', superadmin())).rejects.toBeInstanceOf(
      ConflictException,
    );
    prisma.rolePermission.count.mockResolvedValue(0);
    prisma.menuPermission.count.mockResolvedValue(1);
    await expect(service.remove('p1', superadmin())).rejects.toBeInstanceOf(
      ConflictException,
    );
  });

  it('never changes the key on update', async () => {
    prisma.permission.findUnique.mockResolvedValue({
      id: 'p1',
      key: 'view:widget',
      isProtected: false,
    });
    await service.update('p1', { description: 'changed' }, superadmin());
    const data = prisma.permission.update.mock.calls[0][0].data;
    expect(data).not.toHaveProperty('key');
  });

  it('reports drift between policies and database permissions', async () => {
    prisma.permission.findMany.mockResolvedValue([
      { key: 'legacy:unused' },
      { key: 'read:article' },
    ]);
    const result = await service.drift();
    expect(result.orphan).toContain('legacy:unused');
    expect(result.unregistered.length).toBeGreaterThan(0);
  });

  it('returns not found for a missing permission', async () => {
    await expect(service.get('missing')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
