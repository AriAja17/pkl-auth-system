import {
  IsArray,
  IsEmail,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { USERNAME_PATTERN } from '../../auth/utils/username';

export class CreateUserDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @IsString({ message: 'Password wajib diisi' })
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(USERNAME_PATTERN, { message: 'Username harus [a-z0-9_]{3,30}' })
  username?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  phone?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  roleIds?: string[];
}
