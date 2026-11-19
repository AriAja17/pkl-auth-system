import { IsArray, IsOptional } from 'class-validator';
import { IsPermissionKey } from '../../common/validation/rules';

export class SetPermissionsDto {
  @IsOptional()
  @IsArray()
  @IsPermissionKey({ each: true })
  permissionKeys?: string[];

  /** Legacy body field kept for compatibility with existing clients. */
  @IsOptional()
  @IsArray()
  @IsPermissionKey({ each: true })
  permissions?: string[];
}
