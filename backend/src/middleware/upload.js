import multer from 'multer';
import { AppError } from '../utils/AppError.js';

const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);

// memoryStorage keeps the file in RAM just long enough for sharp to process it.
// The declared type is only a first filter: sharp re-checks the real content.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 12, fieldSize: 10_000 },
  fileFilter: (req, file, cb) =>
    ALLOWED.has(file.mimetype)
      ? cb(null, true)
      : cb(new AppError(400, 'Only JPEG, PNG or WebP images are allowed')),
});

// Reads ONE optional file from a form field named "photo". JSON requests pass through untouched.
export const uploadPhoto = upload.single('photo');