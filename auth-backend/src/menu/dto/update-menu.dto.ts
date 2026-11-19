import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { IsMenuUrl, IsPrimeIcon } from '../../common/validation/rules';

export class UpdateMenuDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsMenuUrl()
  url?: string;

  @IsOptional()
  @IsPrimeIcon()
  icon?: string;

  @IsOptional()
  @IsUUID('all')
  parentId?: string;

  @IsOptional()
  @IsArray()
  @IsUUID('all', { each: true })
  permissionIds?: string[];

  @IsOptional()
  @IsInt()
  order?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
