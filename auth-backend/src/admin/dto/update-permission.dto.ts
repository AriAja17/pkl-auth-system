import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

/** The permission key itself is immutable via API to avoid breaking decorators. */
export class UpdatePermissionDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isProtected?: boolean;
}
