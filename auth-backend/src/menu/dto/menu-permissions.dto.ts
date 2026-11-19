import { IsArray, IsUUID } from 'class-validator';

export class MenuPermissionsDto {
  @IsArray()
  @IsUUID('all', { each: true })
  permissionIds: string[];
}
