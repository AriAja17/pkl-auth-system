import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SYSTEM_ROLE_NAME } from './constants';
import { findPolicy, PermissionMode } from './policies';
import { Principal, toLegacyPermissionKeys } from './principal';
import { buildMenuTree } from '../menu/menu-tree';

export type VisibleMenu = {
  id: string;
  name: string;
  url: string | null;
  icon: string | null;
  parentId: string | null;
  order: number;
  description: string | null;
  children: VisibleMenu[];
};

@Injectable()
export class AuthorizationService {
  constructor(private prisma: PrismaService) {}

  /** Single entry point used by JwtAuthGuard and by services that need a principal. */
  async resolvePrincipal(userId: string): Promise<Principal> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        legacyRole: true,
        roles: {
          include: {
            role: {
              include: {
                permissions: { include: { permission: true } },
              },
            },
          },
        },
        capabilities: { include: { permission: true } },
      },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('User tidak aktif atau tidak ditemukan');
    }

    const permissions = new Set<string>();
    const roles = user.roles.map((assignment) => {
      for (const rp of assignment.role.permissions) {
        permissions.add(rp.permission.key);
      }
      return {
        id: assignment.role.id,
        name: assignment.role.name,
        isSystem: assignment.role.isSystem,
      };
    });

    // Capabilities are checked with their lineage (doc 05 §7.3): an expired or
    // dangling ancestor invalidates every descendant, fail closed.
    const allCapabilities = await this.prisma.adminCapability.findMany({
      select: { id: true, parentCapabilityId: true, expiresAt: true },
    });
    const byId = new Map(allCapabilities.map((c) => [c.id, c]));
    const now = new Date();
    const capabilities = new Set<string>();
    for (const capability of user.capabilities) {
      if (this.lineageValid(capability.id, byId, now)) {
        capabilities.add(capability.permission.key);
      }
    }

    return {
      id: user.id,
      email: user.email,
      username: user.username,
      isActive: user.isActive,
      roles,
      permissions,
      capabilities,
      isSystem: roles.some((role) => role.isSystem),
      legacyRoleName: user.legacyRole?.name ?? null,
      legacyPermissions: toLegacyPermissionKeys(permissions),
    };
  }

  private lineageValid(
    id: string,
    byId: Map<string, { id: string; parentCapabilityId: string | null; expiresAt: Date }>,
    now: Date,
  ): boolean {
    const seen = new Set<string>();
    let current = byId.get(id);
    while (current) {
      if (seen.has(current.id)) return false; // cycle -> fail closed
      seen.add(current.id);
      if (current.expiresAt <= now) return false;
      if (!current.parentCapabilityId) return true; // valid root
      const parent = byId.get(current.parentCapabilityId);
      if (!parent) return false; // dangling ancestor -> fail closed
      current = parent;
    }
    return false;
  }

  /**
   * ALL-of / ANY-of check against canonical permission keys only.
   * `manage:user` is a standalone canonical permission for the deprecated
   * single-role routes; it NEVER bypasses granular endpoint permissions.
   */
  can(
    principal: Principal | undefined,
    required: string[],
    mode: PermissionMode = 'all',
  ): boolean {
    if (!principal || !principal.isActive) return false;
    if (required.length === 0) return true;

    const has = (key: string): boolean => principal.permissions.has(key);

    return mode === 'any' ? required.some(has) : required.every(has);
  }

  /**
   * Backend menu filtering (doc 05 §6, Batch 3): ANY-of permission match.
   * Menus without a permission mapping are hidden by default, and a child whose
   * parent is hidden is also hidden. This is a visibility hint only — never a guard.
   */
  async visibleMenus(principal: Principal): Promise<VisibleMenu[]> {
    const menus: any[] = await this.prisma.menu.findMany({
      where: { isActive: true },
      include: { permissions: { include: { permission: true } } },
      orderBy: [{ order: 'asc' }, { name: 'asc' }],
    });

    const allById = new Map(menus.map((menu) => [menu.id, menu]));
    const visible = menus.filter(
      (menu) =>
        menu.permissions.length > 0 &&
        menu.permissions.some((mp: any) => principal.permissions.has(mp.permission.key)),
    );
    const visibleIds = new Set(visible.map((menu) => menu.id));

    const effectivelyVisible = (menu: any): boolean => {
      let parentId: string | null = menu.parentId;
      const seen = new Set<string>();
      while (parentId) {
        if (seen.has(parentId) || !visibleIds.has(parentId)) return false;
        seen.add(parentId);
        parentId = allById.get(parentId)?.parentId ?? null;
      }
      return true;
    };

    const nodes = visible.filter(effectivelyVisible).map((menu) => ({
      id: menu.id,
      name: menu.name,
      url: menu.url ?? null,
      icon: menu.icon ?? null,
      parentId: menu.parentId ?? null,
      order: menu.order,
      description: menu.description ?? null,
      children: [] as VisibleMenu[],
    }));
    return buildMenuTree(nodes);
  }

  /** Fail-closed endpoint authorization against the policy registry. */
  assertCanManage(principal: Principal | undefined, method: string, path: string): void {
    const policy = findPolicy(method, path);
    if (!policy) {
      throw new ForbiddenException('Endpoint tidak terdaftar dalam policy registry');
    }
    if (!this.can(principal, [policy.permission], policy.mode)) {
      throw new ForbiddenException('Anda tidak punya izin untuk aksi ini');
    }
  }

  assertCanManagePermission(
    principal: Principal | undefined,
    permission: string,
    mode: PermissionMode = 'all',
  ): void {
    if (!this.can(principal, [permission], mode)) {
      throw new ForbiddenException('Anda tidak punya izin untuk aksi ini');
    }
  }

  /** Three-realm superadmin protection helper (doc 05 §7.1). */
  assertNotSystemRole(role: { name: string; isSystem: boolean }): void {
    if (role.isSystem || role.name === SYSTEM_ROLE_NAME) {
      throw new ForbiddenException('Role sistem tidak dapat diubah');
    }
  }
}
