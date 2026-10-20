import bcrypt from 'bcryptjs';
import * as userRepo from '../repositories/userRepository.js';
import { AppError } from '../utils/AppError.js';

// Cost 10 means 2^10 rounds of hashing: slow enough to frustrate
// attackers, fast enough that users don't notice.
const BCRYPT_COST = 10;

export async function registerCitizen({ fullName, email, phone, password }) {
  const existing = await userRepo.findByEmail(email);
  if (existing) {
    throw new AppError(409, 'An account with this email already exists');
  }

  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

  try {
    return await userRepo.createCitizen({ fullName, email, phone, passwordHash });
  } catch (err) {
    // Two people registering the same email at the same instant could both
    // pass the check above. The database's unique index is the real guard.
    // 23505 is PostgreSQL's "unique violation" code.
    if (err.code === '23505') {
      throw new AppError(409, 'An account with this email already exists');
    }
    throw err;
  }
}