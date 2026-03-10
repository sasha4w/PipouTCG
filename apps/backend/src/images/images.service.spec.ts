import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException } from '@nestjs/common';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ImagesService } from './images.service';
import { Image } from './image.entity';

// ← mock sharp et fetch car services externes
jest.mock('sharp', () => () => ({
  resize: jest.fn().mockReturnThis(),
  webp: jest.fn().mockReturnThis(),
  toBuffer: jest.fn().mockResolvedValue(Buffer.from('optimized-image')),
}));

global.fetch = jest.fn();

const mockImageRepo = {
  find: jest.fn(),
  findOneBy: jest.fn(),
  create: jest.fn(),
  save: jest.fn(),
  remove: jest.fn(),
};

const fakeImage: Partial<Image> = {
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

describe('ImagesService', () => {
  let service: ImagesService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ImagesService,
        { provide: getRepositoryToken(Image), useValue: mockImageRepo },
      ],
    }).compile();

    service = module.get<ImagesService>(ImagesService);
  });

  afterEach(() => jest.clearAllMocks());

  // ======= FIND ALL =======
  describe('findAll', () => {
    it('should return all images ordered by name', async () => {
      mockImageRepo.find.mockResolvedValue([fakeImage]);

      const result = await service.findAll();
      expect(result).toEqual([fakeImage]);
      expect(mockImageRepo.find).toHaveBeenCalledWith({
        order: { name: 'ASC' },
      });
    });

    it('should return empty array if no images', async () => {
      mockImageRepo.find.mockResolvedValue([]);

      const result = await service.findAll();
      expect(result).toEqual([]);
    });
  });

  // ======= FIND ONE =======
  describe('findOne', () => {
    it('should return image if found', async () => {
      mockImageRepo.findOneBy.mockResolvedValue(fakeImage);

      const result = await service.findOne(1);
      expect(result).toEqual(fakeImage);
    });

    it('should throw NotFoundException if not found', async () => {
      mockImageRepo.findOneBy.mockResolvedValue(null);

      await expect(service.findOne(999)).rejects.toThrow(NotFoundException);
    });
  });

  // ======= UPLOAD AND SAVE =======
  describe('uploadAndSave', () => {
    it('should optimize, upload to ImgBB and save in DB', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          data: {
            url: 'https://i.ibb.co/xxx/dragon-inferno.webp',
            delete_url: 'https://ibb.co/delete/abc123',
          },
        }),
      });

      mockImageRepo.create.mockReturnValue(fakeImage);
      mockImageRepo.save.mockResolvedValue(fakeImage);

      const result = await service.uploadAndSave(fakeFile, 'Dragon Inferno');

      expect(global.fetch).toHaveBeenCalledWith(
        expect.stringContaining('api.imgbb.com'),
        expect.objectContaining({ method: 'POST' }),
      );
      expect(mockImageRepo.create).toHaveBeenCalledWith({
        name: 'dragon-inferno', // ← slug
        url: 'https://i.ibb.co/xxx/dragon-inferno.webp',
        deleteHash: 'abc123',
      });
      expect(result).toEqual(fakeImage);
    });

    it('should slugify name with accents correctly', async () => {
      (global.fetch as jest.Mock).mockResolvedValue({
        json: jest.fn().mockResolvedValue({
          data: {
            url: 'https://i.ibb.co/xxx/elfe-gardien.webp',
            delete_url: 'https://ibb.co/delete/xyz789',
          },
        }),
      });

      mockImageRepo.create.mockReturnValue({
        ...fakeImage,
        name: 'elfe-gardien',
      });
      mockImageRepo.save.mockResolvedValue({
        ...fakeImage,
        name: 'elfe-gardien',
      });

      await service.uploadAndSave(fakeFile, 'Elfe Gardien');

      expect(mockImageRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'elfe-gardien' }),
      );
    });
  });

  // ======= REMOVE =======
  describe('remove', () => {
    it('should delete on ImgBB and remove from DB', async () => {
      mockImageRepo.findOneBy.mockResolvedValue(fakeImage);
      (global.fetch as jest.Mock).mockResolvedValue({});
      mockImageRepo.remove.mockResolvedValue(undefined);

      const result = await service.remove(1);

      expect(global.fetch).toHaveBeenCalledWith(
        `https://api.imgbb.com/1/image/${fakeImage.deleteHash}`,
        { method: 'DELETE' },
      );
      expect(mockImageRepo.remove).toHaveBeenCalledWith(fakeImage);
      expect(result).toEqual({ message: 'Image 1 deleted' });
    });

    it('should throw NotFoundException if image not found', async () => {
      mockImageRepo.findOneBy.mockResolvedValue(null);

      await expect(service.remove(999)).rejects.toThrow(NotFoundException);
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  // ======= SLUG =======
  describe('toSlug (private)', () => {
    it('should convert name to slug', () => {
      const cases = [
        ['Dragon Inferno', 'dragon-inferno'],
        ['Elfe Gardien', 'elfe-gardien'],
        ['Épée Légendaire', 'epee-legendaire'],
        ['  spaces  ', 'spaces'],
        ['Special!!Card', 'special-card'],
      ];

      for (const [input, expected] of cases) {
        expect((service as any).toSlug(input)).toBe(expected);
      }
    });
  });
});
