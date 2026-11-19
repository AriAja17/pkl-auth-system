import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PermissionsGuard } from './permissions.guard';
import { AuthorizationService } from '../../authorization/authorization.service';
import {
  RequireAnyPermissions,
  RequirePermissions,
} from '../decorators/permissions.decorator';
import { Principal } from '../../authorization/principal';

const principal = (keys: string[], isActive = true): Principal => ({
  id: 'u1',
  email: 'user@example.com',
  username: 'user',
  isActive,
  roles: [],
  permissions: new Set(keys),
  capabilities: new Set(),
  isSystem: false,
  legacyRoleName: null,
  legacyPermissions: [],
});

function contextFor(handler: unknown, user?: Principal): ExecutionContext {
  return {
    getHandler: () => handler,
    getClass: () => class TestController {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

describe('PermissionsGuard', () => {
  const authorization = new AuthorizationService({
    user: { findUnique: jest.fn() },
    adminCapability: { findMany: jest.fn() },
  } as never);
  let guard: PermissionsGuard;

  beforeEach(() => {
    guard = new PermissionsGuard(new Reflector(), authorization);
  });

  it('RequirePermissions uses ALL-of semantics', () => {
    class Handler {
      @RequirePermissions('read:article', 'update:article')
      all() {}
    }
    expect(() =>
      guard.canActivate(contextFor(Handler.prototype.all, principal(['read:article']))),
    ).toThrow(ForbiddenException);
    expect(
      guard.canActivate(
        contextFor(Handler.prototype.all, principal(['read:article', 'update:article'])),
      ),
    ).toBe(true);
  });

  it('RequireAnyPermissions uses ANY-of semantics', () => {
    class Handler {
      @RequireAnyPermissions('read:article', 'update:article')
      any() {}
    }
    expect(
      guard.canActivate(contextFor(Handler.prototype.any, principal(['update:article']))),
    ).toBe(true);
    expect(() =>
      guard.canActivate(contextFor(Handler.prototype.any, principal([]))),
    ).toThrow(ForbiddenException);
  });

  it('fails closed when no principal is present or the user is inactive', () => {
    class Handler {
      @RequirePermissions('read:article')
      read() {}
    }
    expect(() => guard.canActivate(contextFor(Handler.prototype.read))).toThrow(
      ForbiddenException,
    );
    expect(() =>
      guard.canActivate(
        contextFor(Handler.prototype.read, principal(['read:article'], false)),
      ),
    ).toThrow(ForbiddenException);
  });
});
