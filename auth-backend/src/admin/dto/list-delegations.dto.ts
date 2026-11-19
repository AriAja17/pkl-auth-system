import { IsOptional, IsUUID } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class ListDelegationsQueryDto extends PaginationQueryDto {
  @IsOptional()
  @IsUUID('all')
  granteeId?: string;
}
