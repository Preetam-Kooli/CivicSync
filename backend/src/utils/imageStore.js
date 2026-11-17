import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { v2 as cloudinary } from 'cloudinary';
import { env } from '../config/env.js';
import { AppError } from './AppError.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// backend/uploads: used only when Cloudinary is not configured
export const UPLOAD_DIR = path.join(__dirname, '..', '..', 'uploads');

if (env.cloudinaryUrl) cloudinary.config({ secure: true }); // reads CLOUDINARY_URL from the environment

// Re-encoding proves the file really is an image (a renamed .exe fails here),
// removes hidden metadata such as the GPS position inside phone photos, and caps the size.
async function reencode(buffer) {
  try {
    return await sharp(buffer, { limitInputPixels: 40_000_000 })
      .rotate() // apply the camera's rotation; the metadata is dropped afterwards
      .resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true })
      .jpeg({ quality: 80, mozjpeg: true })
      .toBuffer();
  } catch {
    throw new AppError(400, 'The file is not a valid image');
  }
}

// Returns the URL to store in the database
export async function saveImage(buffer, kind) {
  const jpeg = await reencode(buffer);

  if (env.cloudinaryUrl) {
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream({ folder: `civicsync/${kind}`, resource_type: 'image' }, (err, result) =>
          err ? reject(err) : resolve(result.secure_url)
        )
        .end(jpeg);
    });
  }

  await fs.mkdir(UPLOAD_DIR, { recursive: true });
  const name = `${kind}-${crypto.randomUUID()}.jpg`;
  await fs.writeFile(path.join(UPLOAD_DIR, name), jpeg);
  return `/uploads/${name}`;
}