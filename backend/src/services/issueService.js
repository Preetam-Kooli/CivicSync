import { pool } from '../config/db.js';
import * as issueRepo from '../repositories/issueRepository.js';
import { saveImage } from '../utils/imageStore.js';
import { AppError } from '../utils/AppError.js';

const STATUSES = new Set(['reported', 'verified', 'assigned', 'in_progress', 'resolved']);
const MODULES = new Set(['public_service', 'streetlight', 'flood', 'road', 'fire']);

export const listCategories = () => issueRepo.listCategories();
export const mapCollection = () => issueRepo.mapCollection();
export const listMine = (userId) => issueRepo.listForReporter(userId);

// Phase 6 replaces this with duplicate detection
export async function createIssue(input, reporterId, file) {
  const photoUrl = file ? await saveImage(file.buffer, 'issue') : null;
  try {
    const id = await issueRepo.insertIssue(pool, { ...input, reporterId, photoUrl });
    return { issue: await issueRepo.getById(pool, id), merged: false };
  } catch (err) {
    if (err.code === '23503') throw new AppError(400, 'Unknown category'); // foreign key violation
    throw err;
  }
}

export function adminList(filters, actor) {
  const status = STATUSES.has(filters.status) ? filters.status : undefined;
  const module = MODULES.has(filters.module) ? filters.module : undefined;
  const scope = actor.role === 'staff' ? actor.department : null; // department-scoped access
  return issueRepo.listAdmin({ status, module }, scope);
}