import { IsArray, IsDateString, IsUUID } from 'class-validator';
import { IsPermissionKey } from '../../common/validation/rules';

export class CreateDelegationDto {
  @IsUUID('all')
  granteeId: string;

  @IsArray()
  @IsPermissionKey({ each: true })
  permissionKeys: string[];

  @IsDateString()
  expiresAt: string;
}
