// Phase 02 — canonical authorization constants (doc 05 §5, doc 07 §M2).
// Canonical keys are `action:resource`. Legacy aliases exist ONLY in /auth/me
// compatibility output and are never accepted by backend guards.

export const SYSTEM_ROLE_NAME = 'superadmin';

export const PROTECTED_PERMISSION_KEYS = new Set<string>([
  'manage:user',
  'grant:admin',
]);

/** Explicit legacy → canonical mapping. No wildcard rewriting. */
export const LEGACY_PERMISSION_MAP: Record<string, string> = {
  'article.read': 'read:article',
  'article.create': 'create:article',
  'article.update': 'update:article',
  'article.delete': 'delete:article',
  'user.manage': 'manage:user',
};

/** Administrative action keys used for policy-registry coverage checks only.
 *  `manage:user` is NOT an aggregate alias for authorization (Phase 03 Batch 1). */
export const ADMIN_ACTION_KEYS = new Set<string>([
  'read:user',
  'create:user',
  'update:user',
  'delete:user',
  'read:role',
  'create:role',
  'update:role',
  'delete:role',
  'read:permission',
  'create:permission',
  'update:permission',
  'delete:permission',
  'read:menu',
  'create:menu',
  'update:menu',
  'delete:menu',
  'read:delegation',
  'create:delegation',
  'delete:delegation',
  'read:audit',
  'grant:admin',
]);

export function isProtectedPermissionKey(key: string): boolean {
  return PROTECTED_PERMISSION_KEYS.has(key);
}
