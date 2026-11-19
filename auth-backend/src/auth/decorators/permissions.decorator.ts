import { applyDecorators, SetMetadata } from '@nestjs/common';
import { PermissionMode } from '../../authorization/policies';

export const PERMISSIONS_KEY = 'permissions';
export const PERMISSION_MODE_KEY = 'permissions_mode';

/** ALL-of: every listed canonical permission must be present (default). */
export const RequirePermissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSION_MODE_KEY, 'all' as PermissionMode),
  );

/** ANY-of: at least one listed canonical permission must be present. */
export const RequireAnyPermissions = (...permissions: string[]) =>
  applyDecorators(
    SetMetadata(PERMISSIONS_KEY, permissions),
    SetMetadata(PERMISSION_MODE_KEY, 'any' as PermissionMode),
  );
