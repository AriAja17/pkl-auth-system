import { IsEmail, IsString, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail({}, { message: 'Format email tidak valid' })
  email: string;

  @IsString({ message: 'Password wajib diisi' })
  @MinLength(8, { message: 'Password minimal 8 karakter' })
  password: string;
}