import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AdminService } from './admin.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PermissionsGuard } from '../auth/guards/permissions.guard';
import { RequirePermissions } from '../auth/decorators/permissions.decorator';
import { CreateRoleDto } from './dto/create-role.dto';
import { SetPermissionsDto } from './dto/set-permissions.dto';
import { AssignRoleDto } from './dto/assign-role.dto';

@Controller('admin')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('user.manage')
export class AdminController {
  constructor(private adminService: AdminService) {}

  @Get('users')
  listUsers() {
    return this.adminService.listUsers();
  }

  @Get('roles')
  listRoles() {
    return this.adminService.listRoles();
  }

  @Get('permissions')
  listPermissions() {
    return this.adminService.listPermissions();
  }

  @Post('roles')
  createRole(@Body() dto: CreateRoleDto) {
    return this.adminService.createRole(dto.name, dto.permissions ?? []);
  }

  @Put('roles/:id/permissions')
  setRolePermissions(@Param('id') id: string, @Body() dto: SetPermissionsDto) {
    return this.adminService.setRolePermissions(id, dto.permissions);
  }

  @Delete('roles/:id')
  deleteRole(@Param('id') id: string) {
    return this.adminService.deleteRole(id);
  }

  @Put('users/:id/role')
  assignRole(
    @Param('id') id: string,
    @Body() dto: AssignRoleDto,
    @Req() req: any,
  ) {
    return this.adminService.assignRole(id, dto.roleId, req.user.id);
  }

  @Delete('users/:id/role')
  revokeRole(@Param('id') id: string, @Req() req: any) {
    return this.adminService.revokeRole(id, req.user.id);
  }

  @Delete('users/:id')
  deleteUser(@Param('id') id: string, @Req() req: any) {
    return this.adminService.deleteUser(id, req.user.id);
  }
}