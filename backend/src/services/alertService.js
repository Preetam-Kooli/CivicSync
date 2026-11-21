import * as repo from '../repositories/alertRepository.js';
import * as auditRepo from '../repositories/auditRepository.js';
import { ensureWeatherFresh } from './weatherService.js';
import { AppError } from '../utils/AppError.js';

export function listActive() {
  ensureWeatherFresh(); // starts a check in the background if one is due; does not slow this response
  return repo.listActive();
}

export const listRecent = () => repo.listRecent();
export const listZones = () => repo.listZones();
export const zonesGeoJSON = () => repo.zonesGeoJSON();

export async function create(input, actor, meta) {
  const alert = await repo.insertManual({ ...input, createdBy: actor.userId });
  await auditRepo.record({
    userId: actor.userId, email: alert.title.slice(0, 100), portal: 'admin',
    action: 'broadcast_created', success: true, ...meta,
  });
  return alert;
}

export async function withdraw(id, actor, meta) {
  const alert = await repo.withdraw(id);
  if (!alert) throw new AppError(404, 'Alert not found or already withdrawn');
  await auditRepo.record({
    userId: actor.userId, email: alert.title.slice(0, 100), portal: 'admin',
    action: 'broadcast_withdrawn', success: true, ...meta,
  });
}

export const areasGeoJSON = () => repo.areasGeoJSON();