import { IsArray, IsUUID } from 'class-validator';
import { IdParamDto } from '../../common/dto/id-param.dto';

export class UserRolesDto {
  @IsArray()
  @IsUUID('all', { each: true })
  roleIds: string[];
}

export class UserRoleParamsDto extends IdParamDto {
  @IsUUID('all')
  roleId: string;
}
