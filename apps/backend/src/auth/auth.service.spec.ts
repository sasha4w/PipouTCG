import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { QuestService } from '../quests/quest.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

jest.mock('bcrypt', () => ({
  hash: jest.fn().mockResolvedValue('hashed_password'),
  compare: jest.fn(),
}));

const mockUsersService = {
  findByEmail: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('jwt_token'),
};

const mockQuestService = {
  syncUserQuests: jest.fn().mockResolvedValue([]),
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
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

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
      expect(mockQuestService.syncUserQuests).toHaveBeenCalledWith(1); // ← vérifie le sync
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
        { title: 'Ouvre 3 boosters', rewardType: 'GOLD', rewardAmount: 500 }, // ← reward auto-claim
      ]);

      const result = await service.login('john@test.com', '123456');

      expect(result.autoClaimedRewards).toHaveLength(1);
      expect(result.autoClaimedRewards[0].title).toBe('Ouvre 3 boosters');
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null);
      await expect(service.login('unknown@test.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
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
});
