import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { Principal } from '../authorization/principal';
import { AuthorizationService, VisibleMenu } from '../authorization/authorization.service';

/**
 * Temporary /auth/me compatibility shape (Phase 04 removes the legacy fields).
 * `permissions` intentionally mixes canonical keys with their legacy aliases so
 * the unchanged frontend keeps working. Guards NEVER read this response — they
 * authorize exclusively from Principal.permissions (canonical keys only).
 */
export function buildMeResponse(principal: Principal, menus: VisibleMenu[] = []) {
  const canonicalPermissions = [...principal.permissions].sort();
  const permissions = [
    ...new Set([...canonicalPermissions, ...principal.legacyPermissions]),
  ].sort();

  return {
    id: principal.id,
    email: principal.email,
    username: principal.username,
    role: principal.legacyRoleName,
    roles: principal.roles,
    permissions,
    canonicalPermissions,
    legacyPermissions: principal.legacyPermissions,
    menus,
  };
}

@Controller('auth')
export class AuthController {
  constructor(
    private authService: AuthService,
    private authorization: AuthorizationService,
  ) {}

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(JwtAuthGuard)
  @Get('me')
  async me(@Req() req: { user: Principal }) {
    return buildMeResponse(req.user, await this.authorization.visibleMenus(req.user));
  }
}
