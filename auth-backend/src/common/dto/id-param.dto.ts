import { IsUUID } from 'class-validator';

/** Shared UUID path parameter validation for all :id routes. */
export class IdParamDto {
  @IsUUID('all', { message: 'ID harus berupa UUID' })
  id: string;
}
