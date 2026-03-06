import { Injectable } from '@nestjs/common';
import sharp = require('sharp');
@Injectable()
export class UploadService {
  async optimizeAndUpload(file: Express.Multer.File): Promise<string> {
    // Étape 1 — Sharp transforme l'image
    const optimized = await sharp(file.buffer)
      .resize(600, 800, { fit: 'cover' }) // force 600×800
      .webp({ quality: 80 }) // convertit en webp léger
      .toBuffer();

    // Étape 2 — Convertit en base64 pour ImgBB
    const base64 = optimized.toString('base64');

    // Étape 3 — Upload sur ImgBB
    const formData = new FormData();
    formData.append('image', base64);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${process.env.IMGBB_API_KEY}`,
      { method: 'POST', body: formData },
    );

    const data = await response.json();

    // Étape 4 — Retourne l'URL à stocker en DB
    return data.data.url;
  }
}
