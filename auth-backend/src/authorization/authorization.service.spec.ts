import { ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { AuthorizationService } from './authorization.service';
import { Principal } from './principal';
import { PrismaService } from '../prisma/prisma.service';

const makePrincipal = (overrides: Partial<Principal> = {}): Principal => ({
  id: 'u1',
  email: 'user@example.com',
  username: 'user',
  isActive: true,
  roles: [],
  permissions: new Set<string>(),
  capabilities: new Set<string>(),
  isSystem: false,
  legacyRoleName: null,
  legacyPermissions: [],
  ...overrides,
});

describe('AuthorizationService', () => {
  let service: AuthorizationService;
  let prisma: {
    user: { findUnique: jest.Mock };
    adminCapability: { findMany: jest.Mock };
    menu: { findMany: jest.Mock };
  };

  beforeEach(() => {
    prisma = {
      user: { findUnique: jest.fn() },
      adminCapability: { findMany: jest.fn().mockResolvedValue([]) },
      menu: { findMany: jest.fn().mockResolvedValue([]) },
    };
    service = new AuthorizationService(prisma as unknown as PrismaService);
  });

  const roleAssignment = (role: Record<string, unknown>) => ({
    role,
  });

  it('unions permissions from multiple roles and flags system membership', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      username: 'user',
      isActive: true,
      legacyRole: null,
      roles: [
        roleAssignment({
          id: 'r1',
          name: 'Editor',
          isSystem: false,
          permissions: [
            { permission: { key: 'read:article' } },
            { permission: { key: 'update:article' } },
          ],
        }),
        roleAssignment({
          id: 'r2',
          name: 'superadmin',
          isSystem: true,
          permissions: [{ permission: { key: 'manage:user' } }],
        }),
      ],
      capabilities: [],
    });

    const principal = await service.resolvePrincipal('u1');
    expect([...principal.permissions].sort()).toEqual([
      'manage:user',
      'read:article',
      'update:article',
    ]);
    expect(principal.roles.map((r) => r.name)).toEqual(['Editor', 'superadmin']);
    expect(principal.isSystem).toBe(true);
  });

  it('rejects inactive and missing users', async () => {
    prisma.user.findUnique.mockResolvedValueOnce({
      id: 'u1',
      isActive: false,
      roles: [],
      capabilities: [],
    });
    await expect(service.resolvePrincipal('u1')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );

    prisma.user.findUnique.mockResolvedValueOnce(null);
    await expect(service.resolvePrincipal('missing')).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('invalidates capabilities whose ancestor is expired (fail closed)', async () => {
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      username: 'user',
      isActive: true,
      legacyRole: null,
      roles: [],
      capabilities: [
        {
          id: 'child',
          permission: { key: 'create:delegation' },
        },
      ],
    });
    prisma.adminCapability.findMany.mockResolvedValue([
      {
        id: 'child',
        parentCapabilityId: 'root',
        expiresAt: new Date(Date.now() + 86_400_000),
      },
      {
        id: 'root',
        parentCapabilityId: null,
        expiresAt: new Date(Date.now() - 86_400_000),
      },
    ]);

    const principal = await service.resolvePrincipal('u1');
    expect(principal.capabilities.size).toBe(0);
  });

  it('excludes capabilities whose lineage changes permission', async () => {
    const future = new Date(Date.now() + 86_400_000);
    prisma.user.findUnique.mockResolvedValue({
      id: 'u1',
      email: 'user@example.com',
      username: 'user',
      isActive: true,
      legacyRole: null,
      roles: [],
      capabilities: [
        { id: 'good', permission: { key: 'read:user' } },
        { id: 'bad', permission: { key: 'delete:user' } },
      ],
    });
    prisma.adminCapability.findMany.mockResolvedValue([
      { id: 'root-good', permissionId: 'p1', parentCapabilityId: null, expiresAt: future },
      { id: 'good', permissionId: 'p1', parentCapabilityId: 'root-good', expiresAt: future },
      { id: 'bad', permissionId: 'p2', parentCapabilityId: 'root-good', expiresAt: future },
    ]);

    const principal = await service.resolvePrincipal('u1');
    expect([...principal.capabilities]).toEqual(['read:user']);
  });

  it('enforces ALL-of and ANY-of with canonical keys only', () => {
    const principal = makePrincipal({
      permissions: new Set(['read:article', 'manage:user']),
    });

    expect(service.can(principal, ['read:article', 'update:article'])).toBe(false);
    expect(service.can(principal, ['read:article', 'manage:user'])).toBe(true);
    expect(
      service.can(principal, ['update:article', 'manage:user'], 'any'),
    ).toBe(true);
    expect(service.can(makePrincipal(), ['read:article'])).toBe(false);
    expect(
      service.can(makePrincipal({ permissions: new Set(['article.read']) }), [
        'read:article',
      ]),
    ).toBe(false);
  });

  it('does not let manage:user bypass granular endpoint permissions', () => {
    const principal = makePrincipal({ permissions: new Set(['manage:user']) });
    expect(service.can(principal, ['manage:user'])).toBe(true);
    expect(service.can(principal, ['read:user'])).toBe(false);
    expect(service.can(principal, ['update:role'])).toBe(false);
    expect(service.can(principal, ['read:article'])).toBe(false);
  });

  it('protects system roles from configuration, assignment and permission changes', () => {
    expect(() =>
      service.assertNotSystemRole({ name: 'superadmin', isSystem: false }),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.assertNotSystemRole({ name: 'Editor', isSystem: true }),
    ).toThrow(ForbiddenException);
    expect(() =>
      service.assertNotSystemRole({ name: 'Editor', isSystem: false }),
    ).not.toThrow();
  });

  describe('visibleMenus', () => {
    const menu = (id: string, parentId: string | null, keys: string[]) => ({
      id,
      name: id,
      url: `/${id}`,
      icon: null,
      parentId,
      order: 0,
      description: null,
      isActive: true,
      permissions: keys.map((key) => ({ permission: { key } })),
    });

    it('uses ANY-of and hides menus without permission mappings', async () => {
      prisma.menu.findMany.mockResolvedValue([
        menu('articles', null, ['read:article']),
        menu('users', null, ['read:user', 'delete:user']),
        menu('public', null, []),
      ]);
      const principal = makePrincipal({
        permissions: new Set(['read:article', 'read:user']),
      });
      const result = await service.visibleMenus(principal);
      expect(result.map((m) => m.id)).toEqual(['articles', 'users']);
      expect(result.map((m) => m.children)).toEqual([[], []]);
    });

    it('hides a child whose parent is hidden', async () => {
      prisma.menu.findMany.mockResolvedValue([
        menu('hidden-parent', null, ['read:user']),
        menu('visible-child', 'hidden-parent', ['read:article']),
      ]);
      const principal = makePrincipal({ permissions: new Set(['read:article']) });
      expect(await service.visibleMenus(principal)).toEqual([]);
    });

    it('builds a visible parent-child tree', async () => {
      prisma.menu.findMany.mockResolvedValue([
        menu('parent', null, ['read:article']),
        menu('child', 'parent', ['read:article']),
      ]);
      const principal = makePrincipal({ permissions: new Set(['read:article']) });
      const result = await service.visibleMenus(principal);
      expect(result).toHaveLength(1);
      expect(result[0].children[0].id).toBe('child');
    });
  });
});
