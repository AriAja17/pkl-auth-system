import { IsEmail, IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { USERNAME_PATTERN } from '../utils/username';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @IsString({ message: 'Password wajib diisi' })
  @MinLength(6, { message: 'Password minimal 6 karakter' })
  password: string;

  @IsOptional()
  @IsString()
  @Matches(USERNAME_PATTERN, {
    message: 'Username harus 3-30 karakter [a-z0-9_]',
  })
  username?: string;
}
