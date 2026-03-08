import { Test, TestingModule } from '@nestjs/testing';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';

// Mock bcrypt pour ne pas faire de vrai hash (lent)
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

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: mockUsersService },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= LOGIN =======
  describe('login', () => {
    it('should return access_token if credentials are valid', async () => {
      const fakeUser = {
        id: 1,
        email: 'john@test.com',
        password: 'hashed',
        is_admin: false,
      };

      mockUsersService.findByEmail.mockResolvedValue(fakeUser);
      (bcrypt.compare as jest.Mock).mockResolvedValue(true); // mot de passe correct

      const result = await service.login('john@test.com', '123456');

      expect(result).toEqual({ access_token: 'jwt_token' });
      expect(mockJwtService.sign).toHaveBeenCalledWith({
        sub: fakeUser.id,
        is_admin: fakeUser.is_admin,
      });
    });

    it('should throw UnauthorizedException if user not found', async () => {
      mockUsersService.findByEmail.mockResolvedValue(null); // user inexistant

      await expect(service.login('unknown@test.com', '123456')).rejects.toThrow(
        UnauthorizedException,
      );
    });

    it('should throw UnauthorizedException if password is wrong', async () => {
      mockUsersService.findByEmail.mockResolvedValue({
        id: 1,
        password: 'hashed',
      });
      (bcrypt.compare as jest.Mock).mockResolvedValue(false); // mauvais mot de passe

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

      // Vérifie que le hash a été fait
      expect(bcrypt.hash).toHaveBeenCalledWith('123456', 10);
      // Vérifie que create a été appelé avec le mot de passe hashé
      expect(mockUsersService.create).toHaveBeenCalledWith({
        username: dto.username,
        email: dto.email,
        password: 'hashed_password',
      });
      expect(result).toEqual(fakeUser);
    });
  });
});
