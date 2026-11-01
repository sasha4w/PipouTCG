import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import { UsersService } from '../users/users.service';
import { QuestService } from '../quests/quests.service';
import { MailService } from './mail.service';
import { RegisterDto } from './dto/registerdto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import type { AuthUser, JwtPayload } from './auth-user';
import { SSE_TICKET_TTL, sseTicketSecret } from './sse-ticket';

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
    private readonly questService: QuestService,
    private readonly mailService: MailService,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  private readonly DUMMY_HASH =
    '$2b$10$abcdefghijklmnopqrstuuABCDEFGHIJKLMNOPQRSTUVWXYZ012334';

  async login(email: string, password: string, rememberMe = false) {
    const user = await this.usersService.findByEmail(email);
    const passwordToCompare = user?.password ?? this.DUMMY_HASH;
    const isValid = await bcrypt.compare(password, passwordToCompare);

    if (!user || !isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Tes quêtes (Fire and forget)
    this.questService
      .syncUserQuests(user.id)
      .catch((err) => console.error('syncUserQuests failed:', err));

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      is_admin: user.is_admin,
    };

    // 1. Définir la durée en fonction du rememberMe
    const duration = rememberMe ? '30d' : '1d';

    return {
      // 2. PASSER la durée ici pour que le JWT expire en même temps que le Cookie
      access_token: this.jwtService.sign(payload, { expiresIn: duration }),
      autoClaimedRewards: [],
    };
  }

  /** Ticket à usage SSE : 2 min, signé avec un secret distinct de la session. */
  createSseTicket(user: AuthUser) {
    const secret = process.env.JWT_SECRET;
    if (!secret) throw new Error('JWT_SECRET absent');
    return {
      ticket: this.jwtService.sign(
        { sub: user.userId, is_admin: user.isAdmin },
        { secret: sseTicketSecret(secret), expiresIn: SSE_TICKET_TTL },
      ),
    };
  }

  async register(dto: RegisterDto) {
    const existing = await this.usersService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Email déjà utilisé');

    const rounds = process.env.NODE_ENV === 'test' ? 1 : 10;
    const hash = await bcrypt.hash(dto.password, rounds);

    const user = await this.usersService.create({
      username: dto.username,
      email: dto.email,
      password: hash,
    });
    this.eventEmitter.emit('user.registered', { userId: user.id });
    const { password, resetTokenHash, resetTokenExpiry, ...result } = user;
    return result;
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
