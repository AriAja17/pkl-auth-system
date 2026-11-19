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

const capability = (
  id: string,
  userId: string,
  key: string,
  parent: string | null = null,
  permissionId = 'p1',
) => ({
  id,
  userId,
  grantedBy: 'actor-1',
  permissionId,
  parentCapabilityId: parent,
  expiresAt: new Date(Date.now() + 20 * 24 * 60 * 60 * 1000),
  grantedAt: new Date(),
  permission: { key },
});

describe('DelegationService', () => {
  let prisma: any;
  let audit: any;
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
    audit = { record: jest.fn().mockResolvedValue(undefined) };
    service = new DelegationService(prisma as unknown as PrismaService, audit);
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

  it('rejects an active duplicate capability for the same grantee/permission', async () => {
    const active = capability('existing', 'user-2', 'read:user');
    prisma.adminCapability.findUnique.mockResolvedValue(active);
    prisma.adminCapability.findMany.mockResolvedValue([active]);

    await expect(
      service.create({ granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future }, superadmin()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.adminCapability.delete).not.toHaveBeenCalled();
    expect(prisma.adminCapability.create).not.toHaveBeenCalled();
  });

  it('replaces an expired capability instead of blocking re-grant', async () => {
    const expired = {
      ...capability('old-expired', 'user-2', 'read:user'),
      expiresAt: new Date(Date.now() - 1000),
    };
    prisma.adminCapability.findUnique.mockResolvedValue(expired);
    prisma.adminCapability.findMany.mockResolvedValue([expired]);

    const result: any = await service.create(
      { granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future },
      superadmin(),
    );

    expect(prisma.adminCapability.delete).toHaveBeenCalledWith({ where: { id: 'old-expired' } });
    expect(prisma.adminCapability.create).toHaveBeenCalledTimes(1);
    expect(result[0].permissionKey).toBe('read:user');
    expect(result[0].parentCapabilityId).toBeNull();
  });

  it('replaces a capability invalidated by an expired ancestor and reuses a valid source', async () => {
    const expiredAncestor = {
      ...capability('root-old', 'actor-1', 'read:user'),
      expiresAt: new Date(Date.now() - 1000),
    };
    const staleChild = capability('child-old', 'user-2', 'read:user', 'root-old');
    const source = capability('cap-src', 'actor-1', 'read:user');
    prisma.adminCapability.findUnique.mockResolvedValue(staleChild);
    prisma.adminCapability.findMany.mockResolvedValue([expiredAncestor, staleChild, source]);

    const actor = { ...limited(), capabilities: new Set(['read:user']) };
    await service.create(
      { granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future },
      actor,
    );

    expect(prisma.adminCapability.delete).toHaveBeenCalledTimes(1);
    expect(prisma.adminCapability.delete).toHaveBeenCalledWith({ where: { id: 'child-old' } });
    expect(prisma.adminCapability.create.mock.calls[0][0].data.parentCapabilityId).toBe('cap-src');
  });

  it('invalidates descendants when replacing an expired ancestor and audits both writes', async () => {
    const expiredAncestor = {
      ...capability('root-old', 'user-2', 'read:user'),
      expiresAt: new Date(Date.now() - 1000),
    };
    const child = capability('child', 'user-2', 'read:user', 'root-old');
    const grandchild = capability('grandchild', 'user-3', 'read:user', 'child');
    prisma.adminCapability.findUnique.mockResolvedValue(expiredAncestor);
    prisma.adminCapability.findMany.mockResolvedValue([expiredAncestor, child, grandchild]);

    const result: any = await service.create(
      { granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future },
      superadmin(),
    );

    expect(prisma.adminCapability.delete).toHaveBeenCalledWith({ where: { id: 'root-old' } });
    expect(result[0].id).toBe('new-cap');
    expect(audit.record.mock.calls.map((call: any[]) => call[0].action)).toEqual([
      'delegation.revoke',
      'delegation.create',
    ]);
    expect(audit.record.mock.calls[0][0].before.id).toBe('root-old');
    expect(audit.record.mock.calls[0][0].after.invalidatedDescendantIds).toEqual([
      'child',
      'grandchild',
    ]);
  });

  it('keeps a valid parent-child pair intact when the child is an active duplicate', async () => {
    const parent = capability('root', 'actor-1', 'read:user');
    const child = capability('child', 'user-2', 'read:user', 'root');
    prisma.adminCapability.findUnique.mockResolvedValue(child);
    prisma.adminCapability.findMany.mockResolvedValue([parent, child]);

    await expect(
      service.create({ granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future }, superadmin()),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prisma.adminCapability.delete).not.toHaveBeenCalled();
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

  it('keeps a same-permission parent-child lineage valid', async () => {
    prisma.adminCapability.findMany.mockResolvedValue([
      capability('root', 'actor-1', 'read:user', null, 'p1'),
      capability('child', 'user-2', 'read:user', 'root', 'p1'),
    ]);

    const result = await service.list({ page: 1, limit: 10 });
    expect(result.items.find((item) => item.id === 'child')?.valid).toBe(true);
  });

  it('marks a child with a different permission than its parent as invalid', async () => {
    prisma.adminCapability.findMany.mockResolvedValue([
      capability('root', 'actor-1', 'read:user', null, 'p1'),
      capability('child', 'user-2', 'delete:user', 'root', 'p2'),
      capability('grandchild', 'user-3', 'delete:user', 'child', 'p2'),
    ]);

    const result = await service.list({ page: 1, limit: 10 });
    expect(result.items.find((item) => item.id === 'child')?.valid).toBe(false);
    expect(result.items.find((item) => item.id === 'grandchild')?.valid).toBe(false);
  });

  it('treats a permission-mismatched lineage as stale on re-grant', async () => {
    const stale = capability('stale', 'user-2', 'read:user', 'root-src', 'p1');
    prisma.adminCapability.findUnique.mockResolvedValue(stale);
    prisma.adminCapability.findMany.mockResolvedValue([
      capability('root-src', 'actor-1', 'delete:user', null, 'p2'),
      stale,
    ]);

    const result: any = await service.create(
      { granteeId: 'user-2', permissionKeys: ['read:user'], expiresAt: future },
      superadmin(),
    );

    expect(prisma.adminCapability.delete).toHaveBeenCalledWith({ where: { id: 'stale' } });
    expect(prisma.adminCapability.create).toHaveBeenCalledTimes(1);
    expect(result[0].id).toBe('new-cap');
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
