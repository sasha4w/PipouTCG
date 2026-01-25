import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';

import { UsersService } from '../users/users.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const payload = { sub: user.id };

    return {
      access_token: this.jwtService.sign(payload),
    };
  }

  async register(data: { email: string; password: string }) {
    const hash = await bcrypt.hash(data.password, 10);

    return this.usersService.create({
      email: data.email,
      password: hash,
    });
  }
}
