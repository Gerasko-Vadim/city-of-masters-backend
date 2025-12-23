import { IsString, MinLength } from 'class-validator';

export class RegisterOperatorDto {
  @IsString()
  username: string;

  @IsString()
  @MinLength(6)
  password: string;
}
