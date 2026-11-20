import * as repo from '../repositories/analyticsRepository.js';
import { ensureAnalyticsFresh } from './maintenanceService.js';
import { AppError } from '../utils/AppError.js';

const MODULES = new Set(['public_service', 'streetlight', 'flood', 'road', 'fire']);
const STATUSES = new Set(['reported', 'verified', 'assigned', 'in_progress', 'resolved']);
const DATE = /^\d{4}-\d{2}-\d{2}$/;

// Staff are locked to their own department. Admins may pick one.
const scopeModule = (filters, actor) =>
  actor.role === 'staff' ? actor.department : MODULES.has(filters.module) ? filters.module : null;

const oneOf = (value, allowed, fallback) => (allowed.includes(Number(value)) ? Number(value) : fallback);

export const adminAnalytics = (filters, actor) => repo.adminAnalytics(scopeModule(filters, actor));

export const hotspots = (filters, actor) =>
  repo.hotspots({
    days: oneOf(filters.days, [30, 90, 180, 365], 180),
    cell: oneOf(filters.cell, [100, 250, 500], 250),
    minIssues: oneOf(filters.min, [2, 3, 5], 3),
    module: scopeModule(filters, actor),
  });

export async function transparency() {
  await ensureAnalyticsFresh();
  return repo.publicTransparency();
}

export async function openIssues(q) {
  if (q.module && !MODULES.has(q.module)) throw new AppError(400, 'Unknown module');
  if (q.status && !STATUSES.has(q.status)) throw new AppError(400, 'Unknown status');
  for (const key of ['from', 'to']) {
    if (q[key] && !DATE.test(q[key])) throw new AppError(400, `"${key}" must look like 2026-01-31`);
  }
  const limit = Math.min(Math.max(parseInt(q.limit ?? '100', 10) || 100, 1), 500);
  const offset = Math.max(parseInt(q.offset ?? '0', 10) || 0, 0);
  const { total, items } = await repo.openIssues({
    module: q.module, status: q.status, from: q.from, to: q.to, limit, offset,
  });
  return {
    meta: { total, limit, offset, locationPrecision: 'rounded to 3 decimals (about 100 m)' },
    items,
  };
}

export const openCategories = () => repo.openCategories();
export const openMonthly = () => repo.openMonthly();
export const adminSummary = (actor) => repo.adminSummary(actor.role === 'staff' ? actor.department : null);
export const adminReports = (q, actor) => repo.adminReports(scopeModule(q, actor), oneOf(q.days, [7, 30, 90], 30));