import { AppError } from '../utils/AppError.js';

// Only tokens issued for this portal get through
export const requirePortal = (portal) => (req, res, next) =>
  req.auth?.portal === portal ? next() : next(new AppError(403, 'Forbidden'));

// Only these roles get through, e.g. authorize('admin', 'super_admin')
export const authorize = (...roles) => (req, res, next) =>
  roles.includes(req.auth?.role) ? next() : next(new AppError(403, 'Forbidden'));