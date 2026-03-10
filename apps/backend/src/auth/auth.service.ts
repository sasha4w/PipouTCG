import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsersService } from '../users/users.service';
import { QuestService } from '../quests/quests.service';
import { RegisterDto } from './dto/registerdto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly questService: QuestService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user || !(await bcrypt.compare(password, user.password))) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // ← sync + récupère les rewards auto-claim pendant l'absence
    const autoClaimedRewards = await this.questService.syncUserQuests(user.id);

    const payload = { sub: user.id, is_admin: user.is_admin };

    return {
      access_token: this.jwtService.sign(payload),
      autoClaimedRewards, // ← retourné au front
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
