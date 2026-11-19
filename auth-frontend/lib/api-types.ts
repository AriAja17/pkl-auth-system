// Types mirroring the Phase 02/03 backend responses. Canonical permission keys
// are the source of truth for every new authorization check in the UI.

export type RoleView = { id: string; name: string; isSystem: boolean };

export type Me = {
  id: string;
  email: string;
  username: string;
  /** Legacy single-role name, kept only for backward compatibility. */
  role: string | null;
  roles: RoleView[];
  /** May include legacy aliases for the old frontend; not used for new checks. */
  permissions: string[];
  canonicalPermissions: string[];
  legacyPermissions: string[];
  menus: MenuNode[];
};

export type MenuNode = {
  id: string;
  name: string;
  url: string | null;
  icon: string | null;
  parentId: string | null;
  order: number;
  description: string | null;
  isActive: boolean;
  permissions: string[];
  children: MenuNode[];
};

export type Page<T> = {
  items: T[];
  total: number;
  page: number;
  limit: number;
};

export type UserView = {
  id: string;
  email: string;
  username: string;
  name: string | null;
  phone: string | null;
  isActive: boolean;
  roles: RoleView[];
  legacyRole: { id: string; name: string } | null;
};

export type RoleDetail = {
  id: string;
  name: string;
  description: string | null;
  isSystem: boolean;
  permissions: string[];
  usersCount: number;
};

export type PermissionView = {
  id: string;
  key: string;
  description: string | null;
  isProtected: boolean;
  roles: string[];
};

export type DelegationView = {
  id: string;
  granteeId: string;
  permissionKey: string;
  grantedBy: string;
  parentCapabilityId: string | null;
  grantedAt: string;
  expiresAt: string;
  valid: boolean;
};

export type AuditLogView = {
  id: string;
  actorId: string | null;
  actorEmail: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  summary: string | null;
  before: unknown;
  after: unknown;
  createdAt: string;
};
