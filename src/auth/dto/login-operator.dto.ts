import { IsString } from 'class-validator';

export class LoginOperatorDto {
  @IsString()
  username: string;

  @IsString()
  password: string;
}
