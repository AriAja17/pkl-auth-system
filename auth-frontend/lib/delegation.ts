import type { PermissionView } from './api-types';
import { isSystemActor } from './auth-helpers';
import type { Me } from './api-types';

/**
 * Usability filter mirroring the authoritative backend rules in
 * DelegationService.create (auth-backend/src/delegation/delegation.service.ts).
 *
 * Covered here:
 *  1. `grant:admin` is never delegable.
 *  2. `create:delegation` only for actors with an isSystem role.
 *  3. Protected keys only for system actors.
 *  4. Non-system actors need the key in their own permission set.
 *
 * NOT covered (data unavailable to the frontend): the actor's capability set.
 * `/auth/me` does not expose capabilities, and the backend has no endpoint for
 * them. Rule 4's capability half is therefore enforced only by the backend.
 * Frontend filtering is never authorization.
 */
export function delegablePermissions(
  catalog: PermissionView[],
  me: Me | null,
): PermissionView[] {
  const system = isSystemActor(me);
  const owned = new Set(me?.canonicalPermissions ?? []);

  return catalog.filter((permission) => {
    if (permission.key === 'grant:admin') return false;
    if (permission.key === 'create:delegation') return system;
    if (!system) {
      if (permission.isProtected) return false;
      if (!owned.has(permission.key)) return false;
    }
    return true;
  });
}
