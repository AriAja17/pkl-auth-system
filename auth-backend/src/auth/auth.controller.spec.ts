import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthController, buildMeResponse } from './auth.controller';
import { PermissionsGuard } from './guards/permissions.guard';
import { RequirePermissions } from './decorators/permissions.decorator';
import { AuthorizationService } from '../authorization/authorization.service';
import { Principal } from '../authorization/principal';
import { PrismaService } from '../prisma/prisma.service';
import { toLegacyPermissionKeys } from '../authorization/principal';

const canonical = [
  'read:article',
  'create:article',
  'update:article',
  'delete:article',
  'manage:user',
];

const principalWith = (keys: string[], legacyRoleName: string | null = 'Admin'): Principal => ({
  id: 'u1',
  email: 'admin@example.com',
  username: 'admin',
  isActive: true,
  roles: [{ id: 'r1', name: 'superadmin', isSystem: true }],
  permissions: new Set(keys),
  capabilities: new Set(),
  isSystem: true,
  legacyRoleName,
  legacyPermissions: toLegacyPermissionKeys(keys),
});

describe('/auth/me compatibility', () => {
  it('keeps legacy role and adds roles[]', () => {
    const response = buildMeResponse(principalWith(canonical));

    expect(response.role).toBe('Admin');
    expect(response.roles).toEqual([
      { id: 'r1', name: 'superadmin', isSystem: true },
    ]);
  });

  it('exposes both canonical keys and mapped legacy aliases in permissions', () => {
    const response = buildMeResponse(principalWith(canonical));

    // Old frontend checks such as permissions.includes('article.read').
    expect(response.permissions).toEqual(
      expect.arrayContaining([
        'article.read',
        'article.create',
        'article.update',
        'article.delete',
        'user.manage',
      ]),
    );
    // Canonical keys remain available in the same array and separately.
    expect(response.permissions).toEqual(expect.arrayContaining(canonical));
    expect(response.canonicalPermissions).toEqual([...canonical].sort());
    expect(response.legacyPermissions).toEqual(
      expect.arrayContaining(['article.read', 'user.manage']),
    );
    expect(new Set(response.permissions).size).toBe(response.permissions.length);
  });

  it('never authorizes with legacy aliases', () => {
    const legacyOnly = principalWith(['article.read', 'user.manage']);
    const authorization = new AuthorizationService({
      user: { findUnique: jest.fn() },
      adminCapability: { findMany: jest.fn() },
    } as unknown as PrismaService);

    expect(authorization.can(legacyOnly, ['read:article'])).toBe(false);
    expect(authorization.can(legacyOnly, ['manage:user'])).toBe(false);

    const guard = new PermissionsGuard(new Reflector(), authorization);
    class Handler {
      @RequirePermissions('read:article')
      read() {}
    }
    const context = {
      getHandler: () => Handler.prototype.read,
      getClass: () => Handler,
      switchToHttp: () => ({ getRequest: () => ({ user: legacyOnly }) }),
    } as unknown as ExecutionContext;

    expect(() => guard.canActivate(context)).toThrow(ForbiddenException);
  });

  it('returns dynamic visible menus from AuthorizationService', async () => {
    const menus = [
      {
        id: 'm1',
        name: 'Articles',
        url: '/articles',
        icon: null,
        parentId: null,
        order: 0,
        description: null,
        children: [],
      },
    ];
    const authorization = {
      visibleMenus: jest.fn().mockResolvedValue(menus),
    } as unknown as AuthorizationService;
    const controller = new AuthController({} as never, authorization);

    const response = await controller.me({ user: principalWith(canonical) });
    expect(response.menus).toEqual(menus);
    expect(authorization.visibleMenus).toHaveBeenCalled();
    expect(response.role).toBe('Admin');
    expect(response.permissions).toContain('article.read');
  });
});
