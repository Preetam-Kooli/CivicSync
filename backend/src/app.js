import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { query } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import citizenRoutes from './routes/citizenRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import { authenticate } from './middleware/authenticate.js';
import { requirePortal } from './middleware/authorize.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

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

app.use('/api/auth', authRoutes);

// Protected areas: the server enforces who may enter, not the frontend.
// Each area accepts ONLY tokens issued for its own portal.
app.use('/api/citizen', authenticate, requirePortal('citizen'), citizenRoutes);
app.use('/api/admin', authenticate, requirePortal('admin'), adminRoutes);

// These two MUST come last
app.use('/api', notFound);
app.use(errorHandler);

export default app;