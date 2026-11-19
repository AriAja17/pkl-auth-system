import { LEGACY_PERMISSION_MAP } from './constants';

export type RoleView = {
  id: string;
  name: string;
  isSystem: boolean;
};

/** The single principal shape used by every guard and service in Phase 02. */
export type Principal = {
  id: string;
  email: string;
  username: string;
  isActive: boolean;
  roles: RoleView[];
  permissions: Set<string>;
  capabilities: Set<string>;
  isSystem: boolean;
  /** Legacy single-role name, kept only for the transient /auth/me response shape. */
  legacyRoleName: string | null;
  /** Canonical keys translated back to legacy keys, /auth/me dual-key response only. */
  legacyPermissions: string[];
};

/** Translate canonical keys to legacy aliases for the temporary /auth/me response. */
export function toLegacyPermissionKeys(canonical: Iterable<string>): string[] {
  const result = new Set<string>();
  for (const key of canonical) {
    for (const [legacy, canonicalKey] of Object.entries(LEGACY_PERMISSION_MAP)) {
      if (canonicalKey === key) result.add(legacy);
    }
  }
  return [...result].sort();
}
