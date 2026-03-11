import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { QuestService } from '../quests/quests.service';
import { JwtService } from '@nestjs/jwt';
import { MailService } from './mail.service';
import { UnauthorizedException, BadRequestException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

// ← mock uuid pour avoir un token prévisible
jest.mock('uuid', () => ({ v4: jest.fn().mockReturnValue('mock-uuid-token') }));

const mockUsersService = {
  findByEmail: jest.fn(),
  findByResetToken: jest.fn(),
  create: jest.fn(),
  saveResetToken: jest.fn(),
  updatePassword: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('jwt_token'),
};

const mockQuestService = {
  syncUserQuests: jest.fn().mockResolvedValue([]),
};

const mockMailService = {
  sendResetPassword: jest.fn().mockResolvedValue(undefined),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: QuestService, useValue: mockQuestService },
        { provide: MailService, useValue: mockMailService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= LOGIN =======
  describe('login', () => {
    it('should return access_token and empty autoClaimedRewards', async () => {
      const fakeUser = {
        id: 1,
        email: 'john@test.com',
        password: 'hashed',
        is_admin: false,
      };
      mockUsersService.findByEmail.mockResolvedValue(fakeUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockQuestService.syncUserQuests.mockResolvedValue([]);

      const result = await service.login('john@test.com', '123456');

      expect(result).toEqual({
        access_token: 'jwt_token',
        autoClaimedRewards: [],
      });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: 1,
        is_admin: false,
      });
      expect(mockQuestService.syncUserQuests).toHaveBeenCalledWith(1);
    });

    it('should return autoClaimedRewards when quests were auto-claimed', async () => {
      const fakeUser = {
        id: 1,
        email: 'john@test.com',
        password: 'hashed',
        is_admin: false,
      };
      mockUsersService.findByEmail.mockResolvedValue(fakeUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true);
      mockQuestService.syncUserQuests.mockResolvedValue([
        { title: 'Ouvre 3 boosters', rewardType: 'GOLD', rewardAmount: 500 },
      ]);

      const result = await service.login('john@test.com', '123456');

      expect(result.autoClaimedRewards).toHaveLength(1);
      expect(result.autoClaimedRewards[0].title).toBe('Ouvre 3 boosters');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(service.login('unknown@test.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
      expect(bcrypt.compare).toHaveBeenCalledWith('123456', expect.any(String));
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 1,
        password: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false);

      await expect(
        service.login('john@test.com', 'wrong_password'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  // ======= REGISTER =======
  describe('register', () => {
    it('should hash password and call usersService.create', async () => {
      const dto = {
        username: 'john',
        email: 'john@test.com',
        password: '123456',
      };
      const fakeUser = { id: 1, username: 'john', email: 'john@test.com' };
      mockUsersService.create.mockResolvedValue(fakeUser);

      const result = await service.register(dto);

      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);
      expect(mockUsersService.create).toHaveBeenCalledWith({
        username: dto.username,
        email: dto.email,
        password: 'hashed_password',
      });
      expect(result).toEqual(fakeUser);
    });
  });

  // ======= FORGOT PASSWORD =======
  describe('forgotPassword', () => {
    it('should send reset email if user exists', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 1,
        email: 'john@test.com',
      });
      mockUsersService.saveResetToken.mockResolvedValue(undefined);

      const result = await service.forgotPassword({ email: 'john@test.com' });

      expect(mockUsersService.saveResetToken).toHaveBeenCalledWith(
        1,
        'mock-uuid-token',
        expect.any(Date),
      );
      expect(mockMailService.sendResetPassword).toHaveBeenCalledWith(
        'john@test.com',
        'mock-uuid-token',
      );
      expect(result).toEqual({
        message: 'Si cet email existe, un lien a été envoyé.',
      });
    });

    it('should return same message even if user does not exist', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);

      const result = await service.forgotPassword({
        email: 'unknown@test.com',
      });

      expect(mockUsersService.saveResetToken).not.toHaveBeenCalled();
      expect(mockMailService.sendResetPassword).not.toHaveBeenCalled();
      expect(result).toEqual({
        message: 'Si cet email existe, un lien a été envoyé.',
      });
    });
  });

  // ======= RESET PASSWORD =======
  describe('resetPassword', () => {
    it('should update password if token is valid', async () => {
      const fakeUser = {
        id: 1,
        resetToken: 'mock-uuid-token',
        resetTokenExpiry: new Date(Date.now() + 10 * 60 * 1000), // pas expiré
      };
      mockUsersService.findByResetToken.mockResolvedValue(fakeUser);
      mockUsersService.updatePassword.mockResolvedValue(undefined);

      const result = await service.resetPassword({
        token: 'mock-uuid-token',
        newPassword: 'newpass123',
      });

      expect(mockUsersService.updatePassword).toHaveBeenCalledWith(
        1,
        'hashed_password',
      );
      expect(result).toEqual({
        message: 'Mot de passe mis à jour avec succès.',
      });
    });

    it('should throw BadRequestException if token not found', async () => {
      mockUsersService.findByResetToken.mockResolvedValue(null);

      await expect(
        service.resetPassword({
          token: 'invalid-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw BadRequestException if token is expired', async () => {
      const fakeUser = {
        id: 1,
        resetToken: 'mock-uuid-token',
        resetTokenExpiry: new Date(Date.now() - 1000), // ← expiré
      };
      mockUsersService.findByResetToken.mockResolvedValue(fakeUser);

      await expect(
        service.resetPassword({
          token: 'mock-uuid-token',
          newPassword: 'newpass123',
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
