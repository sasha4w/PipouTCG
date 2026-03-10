import { Test, TestingModule } from '@nestjs/testing';
import { ImagesController } from './images.controller';
import { ImagesService } from './images.service';
import { JwtAuthGuard } from '../auth/jwt.authguard';
import { AdminGuard } from '../auth/admin.guard';

const mockImagesService = {
  findAll: jest.fn(),
  uploadAndSave: jest.fn(),
  remove: jest.fn(),
};

const fakeImage = {
  id: 1,
  name: 'dragon-inferno',
  url: 'https://i.ibb.co/xxx/dragon-inferno.webp',
  deleteHash: 'abc123',
};

const fakeFile = {
  fieldname: 'image',
  originalname: 'dragon.png',
  mimetype: 'image/png',
  buffer: Buffer.from('fake-image'),
  size: 1024,
} as Express.Multer.File;

describe('ImagesController', () => {
  let controller: ImagesController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ImagesController],
      providers: [{ provide: ImagesService, useValue: mockImagesService }],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(AdminGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<ImagesController>(ImagesController);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= FIND ALL =======
  describe('findAll', () => {
    it('should return all images', async () => {
      mockImagesService.findAll.mockResolvedValue([fakeImage]);

      const result = await controller.findAll();
      expect(mockImagesService.findAll).toHaveBeenCalled();
      expect(result).toEqual([fakeImage]);
    });

    it('should return empty array if no images', async () => {
      mockImagesService.findAll.mockResolvedValue([]);

      const result = await controller.findAll();
      expect(result).toEqual([]);
    });
  });

  // ======= UPLOAD =======
  describe('upload', () => {
    it('should upload file and return saved image', async () => {
      mockImagesService.uploadAndSave.mockResolvedValue(fakeImage);

      const result = await controller.upload(fakeFile, 'Dragon Inferno');
      expect(mockImagesService.uploadAndSave).toHaveBeenCalledWith(
        fakeFile,
        'Dragon Inferno',
      );
      expect(result).toEqual(fakeImage);
    });
  });

  // ======= REMOVE =======
  describe('remove', () => {
    it('should delete image and return message', async () => {
      mockImagesService.remove.mockResolvedValue({
        message: 'Image 1 deleted',
      });

      const result = await controller.remove(1);
      expect(mockImagesService.remove).toHaveBeenCalledWith(1);
      expect(result).toEqual({ message: 'Image 1 deleted' });
    });
  });
});
