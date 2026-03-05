import { IsString, IsOptional } from 'class-validator';

export class UpdateSpecialistDto {
  @IsString()
  @IsOptional()
  fullName?: string;

  @IsString()
  @IsOptional()
  phone?: string;
}
