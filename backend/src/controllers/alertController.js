import * as alertService from '../services/alertService.js';
import { checkWeather } from '../services/weatherService.js';
import { AppError } from '../utils/AppError.js';
import * as auditRepo from '../repositories/auditRepository.js';

const metaFrom = (req) => ({ ip: req.ip, userAgent: req.get('user-agent') });

function parseId(value) {
  if (!/^\d{1,18}$/.test(value)) throw new AppError(400, 'Invalid id');
  return value;
}

// Public: no login needed
export async function active(req, res) {
  res.set('Cache-Control', 'no-store');
  res.json({ alerts: await alertService.listActive() });
}

export async function zonesGeo(req, res) {
  res.json(await alertService.zonesGeoJSON());
}

export async function listRecent(req, res) {
  res.json({ alerts: await alertService.listRecent() });
}

export async function create(req, res) {
  const alert = await alertService.create(req.body, { userId: req.auth.userId }, metaFrom(req));
  res.status(201).json({ alert });
}

export async function withdraw(req, res) {
  await alertService.withdraw(parseId(req.params.id), { userId: req.auth.userId }, metaFrom(req));
  res.json({ message: 'Alert withdrawn' });
}

export async function listZones(req, res) {
  res.json({ zones: await alertService.listZones() });
}

export async function checkNow(req, res) {
  const summary = await checkWeather('admin');
  await auditRepo.record({
    userId: req.auth.userId, portal: 'admin', action: 'weather_check', success: true, ...metaFrom(req),
  });
  res.json({ summary, zones: await alertService.listZones() });
}

export async function areasGeo(req, res) {
  res.json(await alertService.areasGeoJSON());
}