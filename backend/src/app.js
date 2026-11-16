import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
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

// Where the built React app lives: civicsync/frontend/dist
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
const indexHtml = path.join(distDir, 'index.html');
const hasFrontendBuild = fs.existsSync(indexHtml);

const app = express();

// On Render, requests arrive via Render's proxy. Without this, every visitor
// would look like the same IP and share one rate limit. Production only.
// The hop count is configurable because we measure it after deploying.
if (env.isProd) app.set('trust proxy', env.trustProxyHops);

app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

app.use('/api', apiLimiter);
app.use('/api', csrfGuard);

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
app.use('/api/citizen', noStore, authenticate, requirePortal('citizen'), citizenRoutes);
app.use('/api/admin', noStore, authenticate, requirePortal('admin'), adminRoutes);

// Unknown /api/... URLs get a JSON 404. This must come BEFORE the React app below.
app.use('/api', notFound);

// Serve the built React app from the same address as the API (the single-URL,
// same-origin design). Only active when frontend/dist exists, so normal
// development with the Vite server on port 5173 is unaffected.
if (hasFrontendBuild) {
  app.use(
    express.static(distDir, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          // Files in /assets have a content hash in their name, so a year of caching is safe
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );

  // Any other GET (like /citizen/reports) returns index.html and React Router
  // takes over in the browser. This is what makes page reloads work.
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

app.use(errorHandler);

export default app;