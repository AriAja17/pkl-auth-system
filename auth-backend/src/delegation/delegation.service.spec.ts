import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from '@nestjs/common';
import { DelegationService } from './delegation.service';
import { PrismaService } from '../prisma/prisma.service';
import { Principal } from '../authorization/principal';

const future = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000).toISOString();

const superadmin = (): Principal => ({
  id: 'actor-1',
  email: 'admin@example.com',
  username: 'admin',
  isActive: true,
  roles: [{ id: 'r1', name: 'superadmin', isSystem: true }],
  permissions: new Set(['create:delegation', 'read:user']),
  capabilities: new Set(),
  isSystem: true,
  legacyRoleName: null,
  legacyPermissions: [],
});

const limited = (): Principal => ({
  ...superadmin(),
  isSystem: false,
  roles: [{ id: 'r2', name: 'Editor', isSystem: false }],
});

const capability = (id: string, userId: string, key: string, parent: string | null = null) => ({
  id,
  userId,
  grantedBy: 'actor-1',
  parentCapabilityId: parent,
  expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
  grantedAt: new Date(),
  permission: { key },
});

describe('DelegationService', () => {
  let prisma: any;
  let service: DelegationService;

  beforeEach(() => {
    prisma = {
      adminCapability: {
        findMany: jest.fn().mockResolvedValue([]),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockImplementation(async ({ data }: any) => ({ id: 'new-cap', ...data })),
        delete: jest.fn().mockResolvedValue({}),
      },
      permission: {
        findUnique: jest.fn().mockResolvedValue({ id: 'p1', key: 'read:user', isProtected: false }),
      },
      $transaction: jest.fn(async (arg: any) =>
        Array.isArray(arg) ? Promise.all(arg) : arg(prisma),
      ),
    };
    service = new DelegationService(prisma as unknown as PrismaService);
  });

  it('creates a root capability for superadmin when no source exists', async () => {
    const result: any = await service.create(
      { granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future },
      superadmin(),
    );
    expect(prisma.adminCapability.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-2',
        grantedBy: 'actor-1',
        parentCapabilityId: null,
      }),
    });
    expect(result[0].permissionKey).toBe('read:user');
  });

  it('uses the actor capability as parent for a non-superadmin', async () => {
    prisma.adminCapability.findMany.mockResolvedValue([capability('cap-src', 'actor-1', 'read:user')]);
    const actor = { ...limited(), capabilities: new Set(['read:user']) };
    await service.create(
      { granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future },
      actor,
    );
    expect(prisma.adminCapability.create.mock.calls[0][0].data.parentCapabilityId).toBe('cap-src');
  });

  it('rejects grant:admin and create:delegation for non-superadmin', async () => {
    prisma.permission.findUnique.mockResolvedValue({ id: 'p2', key: 'grant:admin', isProtected: true });
    await expect(
      service.create({ granteeId: 'user-2', permissionKeys: ['grant:admin'], expiresAt: future }, superadmin()),
    ).rejects.toBeInstanceOf(ForbiddenException);

    prisma.permission.findUnique.mockResolvedValue({
      id: 'p3',
      key: 'create:delegation',
      isProtected: false,
    });
    await expect(
      service.create(
        { granteeId: 'user-2', permissionKeys: ['create:delegation'], expiresAt: future },
        limited(),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('enforces max 90 days and rejects past expiry', async () => {
    const tooLong = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
    await expect(
      service.create({ granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: tooLong }, superadmin()),
    ).rejects.toBeInstanceOf(BadRequestException);
    await expect(
      service.create(
        { granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: '2020-01-01T00:00:00.000Z' },
        superadmin(),
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects self-delegation and missing capability boundaries', async () => {
    await expect(
      service.create({ granteeId: 'actor-1', permissionKeys: ['read:user'], expiresAt: future }, superadmin()),
    ).rejects.toBeInstanceOf(ForbiddenException);
    await expect(
      service.create({ granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future }, limited()),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects cycles through the parent chain', async () => {
    prisma.adminCapability.findMany.mockResolvedValue([
      capability('cap-src', 'actor-1', 'read:user', 'cap-ancestor'),
      capability('cap-ancestor', 'user-2', 'read:user'),
    ]);
    const actor = { ...limited(), capabilities: new Set(['read:user']) };
    await expect(
      service.create({ granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future }, actor),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('rejects duplicate capability for the same grantee/permission', async () => {
    prisma.adminCapability.findUnique.mockResolvedValue({ id: 'existing' });
    await expect(
      service.create({ granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future }, superadmin()),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('invalidates descendants when an ancestor is expired', async () => {
    prisma.adminCapability.findMany.mockResolvedValue([
      {
        ...capability('root', 'actor-1', 'read:user'),
        expiresAt: new Date(Date.now() - 1000),
      },
      capability('child', 'user-2', 'read:user', 'root'),
    ]);
    const result = await service.list({ page: 1, limit: 10 });
    expect(result.items.find((item) => item.id === 'child')?.valid).toBe(false);
  });

  it('revokes an ancestor and reports descendant ids', async () => {
    prisma.adminCapability.findUnique.mockResolvedValue(capability('root', 'actor-1', 'read:user'));
    prisma.adminCapability.findMany.mockResolvedValue([
      capability('root', 'actor-1', 'read:user'),
      capability('child', 'user-2', 'read:user', 'root'),
    ]);
    const result = await service.revoke('root', superadmin());
    expect(prisma.adminCapability.delete).toHaveBeenCalledWith({ where: { id: 'root' } });
    expect(result.invalidatedDescendantIds).toEqual(['child']);
  });

  it('refuses self/grantor revocation by a non-superadmin', async () => {
    prisma.adminCapability.findUnique.mockResolvedValue(capability('cap-1', 'actor-1', 'read:user'));
    await expect(service.revoke('cap-1', limited())).rejects.toBeInstanceOf(ForbiddenException);
  });
});
