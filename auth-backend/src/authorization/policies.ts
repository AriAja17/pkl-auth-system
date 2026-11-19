// Policy registry (doc 05 §8): every protected endpoint must be registered here.
// `unregistered` endpoints are a violation, not an informational finding.
// Entries for routes not implemented yet are marked as planned and are used only
// by the consistency checker to distinguish "planned" from "unregistered".

export type PermissionMode = 'all' | 'any';
export type Policy = {
  permission: string;
  mode: PermissionMode;
  /** Route is part of Phase 03 but its controller is not implemented yet. */
  planned?: boolean;
};

export const POLICIES: Record<string, Policy> = {
  // Existing Phase 02 routes
  'GET /admin/users': { permission: 'read:user', mode: 'all' },
  'GET /admin/roles': { permission: 'read:role', mode: 'all' },
  'GET /admin/permissions': { permission: 'read:permission', mode: 'all' },
  'POST /admin/roles': { permission: 'create:role', mode: 'all' },
  'PUT /admin/roles/:id/permissions': { permission: 'update:role', mode: 'all' },
  'DELETE /admin/roles/:id': { permission: 'delete:role', mode: 'all' },
  'PUT /admin/users/:id/role': { permission: 'manage:user', mode: 'all' },
  'DELETE /admin/users/:id/role': { permission: 'manage:user', mode: 'all' },
  'DELETE /admin/users/:id': { permission: 'delete:user', mode: 'all' },
  'GET /articles': { permission: 'read:article', mode: 'all' },
  'POST /articles': { permission: 'create:article', mode: 'all' },
  'PUT /articles/:id': { permission: 'update:article', mode: 'all' },
  'DELETE /articles/:id': { permission: 'delete:article', mode: 'all' },

  // Planned Phase 03 — User management
  'POST /admin/users': { permission: 'create:user', mode: 'all' },
  'GET /admin/users/:id': { permission: 'read:user', mode: 'all' },
  'PATCH /admin/users/:id': { permission: 'update:user', mode: 'all' },
  'PUT /admin/users/:id/roles': { permission: 'update:user', mode: 'all' },
  'POST /admin/users/:id/roles/:roleId': { permission: 'update:user', mode: 'all' },
  'DELETE /admin/users/:id/roles/:roleId': { permission: 'update:user', mode: 'all' },

  // Planned Phase 03 — Role management
  'GET /admin/roles/:id': { permission: 'read:role', mode: 'all' },
  'PATCH /admin/roles/:id': { permission: 'update:role', mode: 'all' },

  // Phase 03 — Permission management (static path before :id)
  'GET /admin/permissions/drift': { permission: 'read:permission', mode: 'all' },
  'POST /admin/permissions': { permission: 'create:permission', mode: 'all' },
  'GET /admin/permissions/:id': { permission: 'read:permission', mode: 'all' },
  'PATCH /admin/permissions/:id': { permission: 'update:permission', mode: 'all' },
  'DELETE /admin/permissions/:id': { permission: 'delete:permission', mode: 'all' },

  // Phase 03 — Menu management
  'GET /admin/menus': { permission: 'read:menu', mode: 'all' },
  'POST /admin/menus': { permission: 'create:menu', mode: 'all' },
  'GET /admin/menus/:id': { permission: 'read:menu', mode: 'all' },
  'PATCH /admin/menus/:id': { permission: 'update:menu', mode: 'all' },
  'DELETE /admin/menus/:id': { permission: 'delete:menu', mode: 'all' },
  'PUT /admin/menus/:id/permissions': { permission: 'update:menu', mode: 'all' },

  // Phase 03 — Delegated administration & audit
  'GET /admin/delegations': { permission: 'read:delegation', mode: 'all' },
  'POST /admin/delegations': { permission: 'create:delegation', mode: 'all' },
  'DELETE /admin/delegations/:id': { permission: 'delete:delegation', mode: 'all' },
  'GET /admin/audit-logs': { permission: 'read:audit', mode: 'all' },
};

type RoutePattern = { method: string; pattern: RegExp; policy: Policy };

const ROUTE_PATTERNS: RoutePattern[] = Object.entries(POLICIES).map(
  ([route, policy]) => {
    const [method, path] = route.split(' ');
    const pattern = new RegExp(
      `^${path
        .split('/')
        .map((segment) =>
          segment.startsWith(':') ? '[^/]+' : segment.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
        )
        .join('/')}$`,
    );
    return { method, pattern, policy };
  },
);

/** Returns the registered policy for a concrete method + path, if any. */
export function findPolicy(method: string, path: string): Policy | undefined {
  return ROUTE_PATTERNS.find(
    (r) => r.method === method.toUpperCase() && r.pattern.test(path),
  )?.policy;
}

/** Routes that require authentication but no granular permission. */
export const TOKEN_ONLY_ROUTES = new Set([
  'GET /',
  'POST /auth/register',
  'POST /auth/login',
  'GET /auth/me',
]);
