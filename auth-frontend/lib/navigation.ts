import type { MenuNode } from './api-types';

/**
 * Single source of truth for route metadata, sidebar navigation and breadcrumbs.
 *
 * Merge strategy (documented for Batch 02+):
 * 1. Static registry entries are the base. A static entry is visible only when
 *    its canonical permission passes `has()` (routes without a permission are
 *    visible to every authenticated user).
 * 2. Backend menus (`GET /auth/me` -> `menus`) are merged as an ADDITIONAL group.
 *    They never replace static navigation.
 * 3. A backend menu URL is rendered only when it matches a known existing route
 *    and is not already present in the static registry. This prevents links to
 *    unimplemented/removed routes and duplicate entries.
 * 4. Backend parent/child visibility is already computed server-side
 *    (ANY-of permission, hidden parents hide children). We preserve that tree;
 *    groups with no remaining children are dropped.
 * 5. Frontend visibility is a hint only. Backend guards remain authoritative.
 */

export type NavGroupId = 'studio' | 'access-activity' | 'dynamic';

export type NavGroup = {
  id: NavGroupId;
  /** Sidebar group label. */
  label: string;
  /** Label used in the breadcrumb for this group. */
  breadcrumbLabel: string;
};

export const NAV_GROUPS: readonly NavGroup[] = [
  { id: 'studio', label: 'Studio', breadcrumbLabel: 'Studio' },
  {
    id: 'access-activity',
    label: 'Access & Activity',
    breadcrumbLabel: 'Access Management',
  },
  { id: 'dynamic', label: 'Menu', breadcrumbLabel: 'Menu' },
] as const;

export type NavRoute = {
  path: string;
  label: string;
  group: Exclude<NavGroupId, 'dynamic'>;
  /** Stable icon identifier. Rendered as inline SVG by the sidebar. */
  icon: string;
  /** Canonical `action:resource` key used by `useAuth().has()`. */
  permission?: string;
  /** Short copy used by landing cards; keeps page copy in the same registry. */
  description?: string;
  /** Keep the route in the shell and breadcrumb, but out of primary navigation. */
  showInNav: boolean;
};

/**
 * Only routes that actually exist in the application are registered here.
 * Projects / Team / Assets / Tasks / Settings are deliberately absent.
 */
export const NAV_ROUTES: readonly NavRoute[] = [
  {
    path: '/dashboard',
    label: 'Overview',
    group: 'studio',
    icon: 'dashboard',
    showInNav: true,
  },
  {
    path: '/articles',
    label: 'Artikel',
    group: 'studio',
    icon: 'file',
    permission: 'read:article',
    // Phase 02: demoted from primary navigation, route preserved.
    showInNav: false,
  },
  {
    path: '/admin',
    label: 'Ringkasan Akses',
    group: 'access-activity',
    icon: 'shield',
    showInNav: true,
  },
  {
    path: '/admin/users',
    label: 'Users',
    group: 'access-activity',
    icon: 'users',
    permission: 'read:user',
    description: 'Kelola akun, multi-role, dan status aktif.',
    showInNav: true,
  },
  {
    path: '/admin/roles',
    label: 'Roles',
    group: 'access-activity',
    icon: 'key',
    permission: 'read:role',
    description: 'Kelola role dan assignment permission.',
    showInNav: true,
  },
  {
    path: '/admin/permissions',
    label: 'Permissions',
    group: 'access-activity',
    icon: 'list',
    permission: 'read:permission',
    description: 'Katalog permission dan drift policy.',
    showInNav: true,
  },
  {
    path: '/admin/menus',
    label: 'Menus',
    group: 'access-activity',
    icon: 'menu',
    permission: 'read:menu',
    description: 'Struktur menu dan permission mapping.',
    showInNav: true,
  },
  {
    path: '/admin/delegations',
    label: 'Delegation',
    group: 'access-activity',
    icon: 'share',
    permission: 'read:delegation',
    description: 'Capability delegasi dan lineage.',
    showInNav: true,
  },
  {
    path: '/admin/audit-logs',
    label: 'Activity / Audit',
    group: 'access-activity',
    icon: 'history',
    permission: 'read:audit',
    description: 'Riwayat aksi administratif.',
    showInNav: true,
  },
] as const;

export type HasPermission = (permission: string) => boolean;

export function visibleNavRoutes(has: HasPermission): NavRoute[] {
  return NAV_ROUTES.filter(
    (route) => route.showInNav && (!route.permission || has(route.permission)),
  );
}

/** True when at least one access-management destination is reachable. */
export function hasVisibleAccessRoute(has: HasPermission): boolean {
  return visibleNavRoutes(has).some((route) => route.group === 'access-activity');
}

export type NavItem = {
  key: string;
  label: string;
  href: string | null;
  icon: string | null;
  children: NavItem[];
  source: 'static' | 'dynamic';
};

export type NavGroupWithItems = {
  id: NavGroupId;
  label: string;
  items: NavItem[];
};

const KNOWN_PATHS = new Set<string>(NAV_ROUTES.map((route) => route.path));
const STATIC_NAV_PATHS = new Set<string>(
  NAV_ROUTES.filter((route) => route.showInNav).map((route) => route.path),
);

function fromDynamicMenus(nodes: MenuNode[]): NavItem[] {
  const result: NavItem[] = [];
  for (const node of nodes ?? []) {
    const children = fromDynamicMenus(node.children ?? []);
    if (node.url) {
      // Unknown URL => would be a dead link. Static duplicate => avoid double entry.
      if (!KNOWN_PATHS.has(node.url) || STATIC_NAV_PATHS.has(node.url)) {
        result.push(...children);
        continue;
      }
      result.push({
        key: `dynamic:${node.id}`,
        label: node.name,
        href: node.url,
        icon: node.icon ?? null,
        children,
        source: 'dynamic',
      });
    } else {
      // Group header: only useful when it still has renderable children.
      if (children.length === 0) continue;
      result.push({
        key: `dynamic:${node.id}`,
        label: node.name,
        href: null,
        icon: node.icon ?? null,
        children,
        source: 'dynamic',
      });
    }
  }
  return result;
}

export function buildNavigation(
  menus: MenuNode[],
  has: HasPermission,
): NavGroupWithItems[] {
  const byGroup = new Map<NavGroupId, NavItem[]>();
  for (const route of visibleNavRoutes(has)) {
    const items = byGroup.get(route.group) ?? [];
    items.push({
      key: `static:${route.path}`,
      label: route.label,
      href: route.path,
      icon: route.icon,
      children: [],
      source: 'static',
    });
    byGroup.set(route.group, items);
  }

  const dynamicItems = fromDynamicMenus(menus ?? []);
  if (dynamicItems.length > 0) byGroup.set('dynamic', dynamicItems);

  return NAV_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    items: byGroup.get(group.id) ?? [],
  })).filter((group) => group.items.length > 0);
}

export type Crumb = { label: string; href?: string };

/** Breadcrumb metadata derived from the same registry as the sidebar. */
export function breadcrumbFor(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: 'Workspace' }];
  const route = [...NAV_ROUTES]
    .sort((a, b) => b.path.length - a.path.length)
    .find(
      (candidate) =>
        pathname === candidate.path ||
        pathname.startsWith(`${candidate.path}/`),
    );

  if (!route) return crumbs;

  if (route.path !== '/dashboard') {
    const group = NAV_GROUPS.find((candidate) => candidate.id === route.group);
    if (group) crumbs.push({ label: group.breadcrumbLabel });
  }
  crumbs.push({ label: route.label });
  return crumbs;
}

/** Longest-prefix match so parent links do not win over nested routes. */
export function isActivePath(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
