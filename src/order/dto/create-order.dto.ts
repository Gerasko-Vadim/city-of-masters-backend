import {
  IsString,
  IsNumber,
  IsOptional,
  IsDateString,
  Min,
} from 'class-validator';

export class CreateOrderDto {
  @IsString()
  customerName: string;

  @IsString()
  phone: string;

  @IsString()
  address: string;

  @IsNumber()
  @Min(0)
  totalAmount: number;

  @IsDateString()
  @IsOptional()
  scheduledAt?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  lat: number;

  @IsNumber()
  lng: number;
}
