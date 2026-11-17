import { IsArray, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateRoleDto {
  @IsString({ message: 'Nama role wajib diisi' })
  @IsNotEmpty({ message: 'Nama role wajib diisi' })
  name: string;

  @IsOptional()
  @IsArray({ message: 'Permission harus berupa daftar' })
  @IsString({ each: true })
  permissions?: string[];
}