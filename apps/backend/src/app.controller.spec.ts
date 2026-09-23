import { Test, TestingModule } from '@nestjs/testing';
import { getDataSourceToken } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';

const mockDataSource = { query: jest.fn() };

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        { provide: getDataSourceToken(), useValue: mockDataSource },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  afterEach(() => jest.clearAllMocks());

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('health', () => {
    it('should ping the database and report ok', async () => {
      mockDataSource.query.mockResolvedValue([{ 1: 1 }]);

      await expect(appController.health()).resolves.toEqual({
        status: 'ok',
        db: 'connected',
      });
      expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
    });

    it('should fail when the database is unreachable', async () => {
      mockDataSource.query.mockRejectedValue(new Error('ECONNREFUSED'));

      await expect(appController.health()).rejects.toThrow('ECONNREFUSED');
    });
  });
});
