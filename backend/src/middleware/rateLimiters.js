import rateLimit from 'express-rate-limit';

const base = {
  standardHeaders: 'draft-7', // tells clients how many requests they have left
  legacyHeaders: false,
  message: { message: 'Too many requests, please try again later' },
};

const MINUTES_15 = 15 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// A safety net across the whole API
export const apiLimiter = rateLimit({ ...base, windowMs: MINUTES_15, limit: 600 });

export const registerLimiter = rateLimit({ ...base, windowMs: HOUR, limit: 10 });

// skipSuccessfulRequests: only FAILED logins count, so a real user who logs in
// correctly never uses up their budget.
const citizenLogin = rateLimit({
  ...base, windowMs: MINUTES_15, limit: 10, skipSuccessfulRequests: true,
});
const adminLogin = rateLimit({
  ...base, windowMs: MINUTES_15, limit: 5, skipSuccessfulRequests: true,
});

// The Admin tab gets the stricter limit. (Choosing the tab is only a request,
// but the stricter limit applies to whoever asks for it, which is the safe side.)
export const loginLimiter = (req, res, next) =>
  (req.body?.portal === 'admin' ? adminLogin : citizenLogin)(req, res, next);

export const refreshLimiter = rateLimit({ ...base, windowMs: MINUTES_15, limit: 30 });