import type { Me } from './api-types';

/**
 * System-actor detection uses the backend `isSystem` flag, never a role name.
 * Keep this in one place so no page reintroduces hardcoded role comparisons.
 */
export function isSystemActor(me: Me | null): boolean {
  return Boolean(me?.roles?.some((role) => role.isSystem));
}
