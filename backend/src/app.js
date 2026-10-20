import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { query } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

app.use(helmet());

// Read JSON bodies, but refuse huge ones
app.use(express.json({ limit: '10kb' }));

// Makes cookies available as req.cookies (used by the auth middleware in 2C)
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

// These two MUST come last
app.use('/api', notFound);
app.use(errorHandler);

export default app;