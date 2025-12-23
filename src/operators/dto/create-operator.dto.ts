import { IsString, MinLength } from 'class-validator';

export class CreateOperatorDto {
  @IsString()
  name: string;

  @IsString()
  login: string;

  @IsString()
  @MinLength(6)
  password: string;
}
