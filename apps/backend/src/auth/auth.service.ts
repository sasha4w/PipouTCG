import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { RegisterDto } from '../dto/registerdto';

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

    return {
      access_token: this.jwtService.sign({ sub: user.id }),
    };
  }
  async loginAdmin(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);

    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.is_admin) {
      throw new UnauthorizedException('Not an admin');
    }

    return {
      access_token: this.jwtService.sign({
        sub: user.id,
        is_admin: user.is_admin,
      }),
    };
  }
  async register(dto: RegisterDto) {
    const hash = await bcrypt.hash(dto.password, 10);

    return this.usersService.create({
      username: dto.username,
      email: dto.email,
      password: hash,
    });
  }
}
