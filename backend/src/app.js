import express from 'express';
import helmet from 'helmet';
import { query } from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const app = express();

// helmet adds security headers (and removes the X-Powered-By header that
// tells attackers we use Express). We'll tune its settings when we serve
// the React app and the map.
app.use(helmet());

// Read JSON bodies, but refuse huge ones
app.use(express.json({ limit: '10kb' }));

// Health check 1: is the API alive?
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', app: 'CivicSync', time: new Date().toISOString() });
});

// Health check 2: can the API reach the database (and is PostGIS on)?
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