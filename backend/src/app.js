import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { query } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import citizenRoutes from './routes/citizenRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { authenticate } from './middleware/authenticate.js';
import { requirePortal } from './middleware/authorize.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { csrfGuard } from './middleware/csrfGuard.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// On Render, requests arrive via Render's proxy. Without this, every visitor
// would look like the same IP and share one rate limit. Production only.
// (We will confirm the exact proxy setting in Render's docs at deployment.)
if (env.isProd) app.set('trust proxy', 1);

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Safety nets for the whole API
app.use('/api', apiLimiter);
app.use('/api', csrfGuard);

// Sensitive responses must never be stored by browsers or proxies
const noStore = (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'CivicSync', time: new Date().toISOString() });
});

app.get('/api/health/db', async (req, res) => {
  try {
    const result = await query(
      'SELECT PostGIS_Version() AS postgis, version() AS postgres'
    );
    res.json({ status: 'ok', ...result.rows[0] });
  } catch (err) {
    console.error('DB health check failed:', err.message);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.use('/api/auth', noStore, authRoutes);

// Protected areas: each accepts ONLY tokens issued for its own portal.
app.use('/api/citizen', noStore, authenticate, requirePortal('citizen'), citizenRoutes);
app.use('/api/admin', noStore, authenticate, requirePortal('admin'), adminRoutes);

// These two MUST come last
app.use('/api', notFound);
app.use(errorHandler);

export default app;