import { AppError } from '../utils/AppError.js';
import { env } from '../config/env.js';

// Reading data cannot change anything, so GET/HEAD/OPTIONS are not checked
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

export function csrfGuard(req, res, next) {
  if (SAFE_METHODS.has(req.method)) return next();

  // Layer 1: a custom header. A malicious website cannot add custom headers to
  // requests aimed at our domain, because that needs permission (CORS) we never give.
  if (req.get('x-requested-with') !== 'CivicSync') {
    return next(new AppError(403, 'Forbidden'));
  }

  // Layer 2: if the browser says where the request came from, it must be us.
  const origin = req.get('origin');
  if (origin) {
    let originHost;
    try {
      originHost = new URL(origin).host;
    } catch {
      return next(new AppError(403, 'Forbidden')); // e.g. the literal string "null"
    }
    const sameHost = originHost === req.get('host');
    const trustedClient = env.clientOrigin !== null && origin === env.clientOrigin;
    if (!sameHost && !trustedClient) {
      return next(new AppError(403, 'Forbidden'));
    }
  }

  next();
}