import { IsString } from 'class-validator';

export class LoginOperatorDto {
  @IsString()
  login: string;

  @IsString()
  password: string;
}
