import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Image } from './image.entity';
import sharp = require('sharp');

@Injectable()
export class ImagesService {
  constructor(
    @InjectRepository(Image)
    private imageRepository: Repository<Image>,
  ) {}

  async findAll() {
    return this.imageRepository.find({ order: { name: 'ASC' } });
  }

  async findOne(id: number) {
    const image = await this.imageRepository.findOneBy({ id });
    if (!image) throw new NotFoundException(`Image ${id} not found`);
    return image;
  }

  async uploadAndSave(file: Express.Multer.File, name: string): Promise<Image> {
    const slug = this.toSlug(name);

    // Sharp — resize + webp
    const optimized = await sharp(file.buffer)
      .resize(600, 800, {
        fit: 'contain',
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      })
      .webp({ quality: 80 })
      .toBuffer();

    // ImgBB upload
    const base64 = optimized.toString('base64');
    const formData = new FormData();
    formData.append('image', base64);
    formData.append('name', slug);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      { method: 'POST', body: formData },
    );

    const data = await response.json();
    const url: string = data.data.url;
    const deleteUrl: string = data.data.delete_url;
    // Sauvegarde en DB
    const image = this.imageRepository.create({ name: slug, url, deleteUrl });
    return this.imageRepository.save(image);
  }

  async remove(id: number) {
    const image = await this.findOne(id);

    // delete_url complète stockée, ou reconstruite depuis le hash
    await fetch(image.deleteUrl, { method: 'GET' }); // ← GET sur la delete_url

    await this.imageRepository.remove(image);
    return { message: `Image ${id} deleted` };
  }

  private toSlug(name: string): string {
    return name
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
  }
}
