import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { PermissionService } from './permission.service';
import { MenuService } from '../menu/menu.service';
import { DelegationService } from '../delegation/delegation.service';
import { AuditService } from '../audit/audit.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { Principal } from '../authorization/principal';
import { IdParamDto } from '../common/dto/id-param.dto';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserRoleParamsDto, UserRolesDto } from './dto/user-roles.dto';
import { CreatePermissionDto } from './dto/create-permission.dto';
import { UpdatePermissionDto } from './dto/update-permission.dto';
import {
  ListMenusQueryDto,
  ListPermissionsQueryDto,
  ListRolesQueryDto,
  ListUsersQueryDto,
} from './dto/list-query.dto';
import { CreateMenuDto } from '../menu/dto/create-menu.dto';
import { UpdateMenuDto } from '../menu/dto/update-menu.dto';
import { MenuPermissionsDto } from '../menu/dto/menu-permissions.dto';
import { CreateDelegationDto } from './dto/create-delegation.dto';
import { ListDelegationsQueryDto } from './dto/list-delegations.dto';
import { ListAuditLogsQueryDto } from '../audit/dto/list-audit-logs.dto';

// Guards stay at class level; permissions are granular per endpoint.
// `manage:user` is only used by the deprecated single-role aliases below.
@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AdminController {
  constructor(
    private adminService: AdminService,
    private permissionService: PermissionService,
    private menuService: MenuService,
    private delegationService: DelegationService,
    private auditService: AuditService,
  ) {}

  // ---------- User management ----------

  @Get('users')
  @RequirePermissions('read:user')
  listUsers(@Query() query: ListUsersQueryDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users')
  @RequirePermissions('create:user')
  createUser(@Body() dto: CreateUserDto, @Req() req: { user: Principal }) {
    return this.adminService.createUser(dto, req.user);
  }

  @Get('users/:id')
  @RequirePermissions('read:user')
  getUser(@Param() params: IdParamDto) {
    return this.adminService.getUser(params.id);
  }

  @Patch('users/:id')
  @RequirePermissions('update:user')
  updateUser(
    @Param() params: IdParamDto,
    @Body() dto: UpdateUserDto,
    @Req() req: { user: Principal },
  ) {
    return this.adminService.updateUser(params.id, dto, req.user);
  }

  @Delete('users/:id')
  @RequirePermissions('delete:user')
  deleteUser(@Param() params: IdParamDto, @Req() req: { user: Principal }) {
    return this.adminService.deleteUser(params.id, req.user);
  }

  @Put('users/:id/roles')
  @RequirePermissions('update:user')
  replaceUserRoles(
    @Param() params: IdParamDto,
    @Body() dto: UserRolesDto,
    @Req() req: { user: Principal },
  ) {
    return this.adminService.replaceUserRoles(params.id, dto, req.user);
  }

  @Post('users/:id/roles/:roleId')
  @RequirePermissions('update:user')
  addUserRole(@Param() params: UserRoleParamsDto, @Req() req: { user: Principal }) {
    return this.adminService.addUserRole(params.id, params.roleId, req.user);
  }

  @Delete('users/:id/roles/:roleId')
  @RequirePermissions('update:user')
  removeUserRole(@Param() params: UserRoleParamsDto, @Req() req: { user: Principal }) {
    return this.adminService.removeUserRole(params.id, params.roleId, req.user);
  }

  // Deprecated single-role aliases kept for API compatibility.
  @Put('users/:id/role')
  @RequirePermissions('manage:user')
  assignRole(
    @Param() params: IdParamDto,
    @Body() dto: AssignRoleDto,
    @Req() req: { user: Principal },
  ) {
    return this.adminService.assignRole(params.id, dto.roleId, req.user);
  }

  @Delete('users/:id/role')
  @RequirePermissions('manage:user')
  revokeRole(@Param() params: IdParamDto, @Req() req: { user: Principal }) {
    return this.adminService.revokeRole(params.id, req.user);
  }

  // ---------- Role management ----------

  @Get('roles')
  @RequirePermissions('read:role')
  listRoles(@Query() query: ListRolesQueryDto) {
    return this.adminService.listRoles(query);
  }

  @Post('roles')
  @RequirePermissions('create:role')
  createRole(@Body() dto: CreateRoleDto, @Req() req: { user: Principal }) {
    return this.adminService.createRole(dto, req.user);
  }

  @Get('roles/:id')
  @RequirePermissions('read:role')
  getRole(@Param() params: IdParamDto) {
    return this.adminService.getRole(params.id);
  }

  @Patch('roles/:id')
  @RequirePermissions('update:role')
  updateRole(
    @Param() params: IdParamDto,
    @Body() dto: UpdateRoleDto,
    @Req() req: { user: Principal },
  ) {
    return this.adminService.updateRole(params.id, dto, req.user);
  }

  @Delete('roles/:id')
  @RequirePermissions('delete:role')
  deleteRole(@Param() params: IdParamDto, @Req() req: { user: Principal }) {
    return this.adminService.deleteRole(params.id, req.user);
  }

  @Put('roles/:id/permissions')
  @RequirePermissions('update:role')
  setRolePermissions(
    @Param() params: IdParamDto,
    @Body() dto: SetPermissionsDto,
    @Req() req: { user: Principal },
  ) {
    return this.adminService.setRolePermissions(params.id, dto, req.user);
  }

  // ---------- Permission management ----------

  @Get('permissions')
  @RequirePermissions('read:permission')
  listPermissions(@Query() query: ListPermissionsQueryDto) {
    return this.permissionService.list(query);
  }

  @Post('permissions')
  @RequirePermissions('create:permission')
  createPermission(@Body() dto: CreatePermissionDto, @Req() req: { user: Principal }) {
    return this.permissionService.create(dto, req.user);
  }

  @Get('permissions/drift')
  @RequirePermissions('read:permission')
  permissionDrift() {
    return this.permissionService.drift();
  }

  @Get('permissions/:id')
  @RequirePermissions('read:permission')
  getPermission(@Param() params: IdParamDto) {
    return this.permissionService.get(params.id);
  }

  @Patch('permissions/:id')
  @RequirePermissions('update:permission')
  updatePermission(
    @Param() params: IdParamDto,
    @Body() dto: UpdatePermissionDto,
    @Req() req: { user: Principal },
  ) {
    return this.permissionService.update(params.id, dto, req.user);
  }

  @Delete('permissions/:id')
  @RequirePermissions('delete:permission')
  deletePermission(@Param() params: IdParamDto, @Req() req: { user: Principal }) {
    return this.permissionService.remove(params.id, req.user);
  }

  // ---------- Menu management ----------

  @Get('menus')
  @RequirePermissions('read:menu')
  listMenus(@Query() query: ListMenusQueryDto) {
    return this.menuService.list(query);
  }

  @Post('menus')
  @RequirePermissions('create:menu')
  createMenu(@Body() dto: CreateMenuDto, @Req() req: { user: Principal }) {
    return this.menuService.create(dto, req.user);
  }

  @Get('menus/:id')
  @RequirePermissions('read:menu')
  getMenu(@Param() params: IdParamDto) {
    return this.menuService.get(params.id);
  }

  @Patch('menus/:id')
  @RequirePermissions('update:menu')
  updateMenu(
    @Param() params: IdParamDto,
    @Body() dto: UpdateMenuDto,
    @Req() req: { user: Principal },
  ) {
    return this.menuService.update(params.id, dto, req.user);
  }

  @Delete('menus/:id')
  @RequirePermissions('delete:menu')
  deleteMenu(@Param() params: IdParamDto, @Req() req: { user: Principal }) {
    return this.menuService.remove(params.id, req.user);
  }

  @Put('menus/:id/permissions')
  @RequirePermissions('update:menu')
  setMenuPermissions(
    @Param() params: IdParamDto,
    @Body() dto: MenuPermissionsDto,
    @Req() req: { user: Principal },
  ) {
    return this.menuService.setPermissions(params.id, dto, req.user);
  }

  // ---------- Delegated administration ----------

  @Get('delegations')
  @RequirePermissions('read:delegation')
  listDelegations(@Query() query: ListDelegationsQueryDto) {
    return this.delegationService.list(query);
  }

  @Post('delegations')
  @RequirePermissions('create:delegation')
  createDelegation(@Body() dto: CreateDelegationDto, @Req() req: { user: Principal }) {
    return this.delegationService.create(dto, req.user);
  }

  @Delete('delegations/:id')
  @RequirePermissions('delete:delegation')
  revokeDelegation(@Param() params: IdParamDto, @Req() req: { user: Principal }) {
    return this.delegationService.revoke(params.id, req.user);
  }

  // ---------- Audit log ----------

  @Get('audit-logs')
  @RequirePermissions('read:audit')
  listAuditLogs(@Query() query: ListAuditLogsQueryDto) {
    return this.auditService.list(query);
  }
}
