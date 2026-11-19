import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthorizationService } from '../../authorization/authorization.service';
import { PermissionMode } from '../../authorization/policies';
import {
  PERMISSIONS_KEY,
  PERMISSION_MODE_KEY,
} from '../decorators/permissions.decorator';
import { Principal } from '../../authorization/principal';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private authorization: AuthorizationService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!required || required.length === 0) {
      return true;
    }

    const mode = this.reflector.getAllAndOverride<PermissionMode>(
      PERMISSION_MODE_KEY,
      [context.getHandler(), context.getClass()],
    ) ?? 'all';

    const { user } = context.switchToHttp().getRequest<{ user?: Principal }>();
    if (!this.authorization.can(user, required, mode)) {
      throw new ForbiddenException('Anda tidak punya izin untuk aksi ini');
    }
    return true;
  }
}
