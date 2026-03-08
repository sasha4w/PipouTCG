import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

const mockAuthService = {
  register: jest.fn(),
  login: jest.fn(),
};

describe('AuthController', () => {
  let controller: AuthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('register', () => {
    it('should call authService.register with dto', async () => {
      const dto = {
        username: 'john',
        email: 'john@test.com',
        password: '123456',
      };
      mockAuthService.register.mockResolvedValue({ id: 1, email: dto.email });

      const result = await controller.register(dto);

      expect(mockAuthService.register).toHaveBeenCalledWith(dto);
      expect(result).toEqual({ id: 1, email: dto.email });
    });
  });

  describe('login', () => {
    it('should call authService.login with email and password', async () => {
      const dto = { email: 'john@test.com', password: '123456' };
      mockAuthService.login.mockResolvedValue({ access_token: 'jwt_token' });

      const result = await controller.login(dto);

      expect(mockAuthService.login).toHaveBeenCalledWith(
        dto.email,
        dto.password,
      );
      expect(result).toEqual({ access_token: 'jwt_token' });
    });
  });
});
