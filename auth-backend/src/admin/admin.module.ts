import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { PermissionService } from './permission.service';
import { MenuService } from '../menu/menu.service';
import { DelegationService } from '../delegation/delegation.service';

@Module({
  controllers: [AdminController],
  providers: [AdminService, PermissionService, MenuService, DelegationService],
})
export class AdminModule {}
