import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPermissionKey } from '../../common/validation/rules';

export class CreatePermissionDto {
  @IsPermissionKey()
  key: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isProtected?: boolean;
}
