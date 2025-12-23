// src/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { OperatorsService } from '../operators/operators.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly operatorsService: OperatorsService,
    private readonly jwtService: JwtService,
  ) {}

  async login(username: string, password: string) {
    const operator = await this.operatorsService.findByUsername(username);

    if (!operator) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isPasswordValid = await bcrypt.compare(
      password,
      operator.passwordHash,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = {
      sub: operator.id,
      username: operator.username,
    };

    return {
      accessToken: this.jwtService.sign(payload),
    };
  }
}
