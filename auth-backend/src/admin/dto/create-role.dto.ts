import { IsArray, IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';
import { IsPermissionKey } from '../../common/validation/rules';

export class CreateRoleDto {
  @IsString({ message: 'Nama role wajib diisi' })
  @IsNotEmpty({ message: 'Nama role wajib diisi' })
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

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
