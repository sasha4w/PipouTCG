import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { QuestService } from '../quests/quests.service';
import { MailService } from './mail.service';
import { RegisterDto } from './dto/registerdto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly questService: QuestService,
    private readonly mailService: MailService,
  ) {}

  private readonly DUMMY_HASH =
    '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012334';

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    const passwordToCompare = user?.password ?? this.DUMMY_HASH;
    const isValid = await bcrypt.compare(password, passwordToCompare);
    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }
    const autoClaimedRewards = await this.questService.syncUserQuests(user.id);
    const payload = { sub: user.id, is_admin: user.is_admin };
    return {
      access_token: this.jwtService.sign(payload),
      autoClaimedRewards,
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

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.usersService.findByEmail(dto.email);

    if (!user) {
      return { message: 'Si cet email existe, un lien a été envoyé.' };
    }

    const token = uuidv4();
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    await this.usersService.saveResetToken(user.id, token, expiry);
    await this.mailService.sendResetPassword(user.email, token);

    return { message: 'Si cet email existe, un lien a été envoyé.' };
  }

  async resetPassword(dto: ResetPasswordDto) {
    const user = await this.usersService.findByResetToken(dto.token);

    if (!user || !user.resetTokenExpiry || user.resetTokenExpiry < new Date()) {
      throw new BadRequestException('Token invalide ou expiré.');
    }

    const hash = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.updatePassword(user.id, hash);

    return { message: 'Mot de passe mis à jour avec succès.' };
  }
}
