import { IsBoolean, IsOptional } from 'class-validator';

export class UpdateOperatorDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
