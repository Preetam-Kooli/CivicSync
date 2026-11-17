import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { query } from './config/db.js';
import { UPLOAD_DIR } from './utils/imageStore.js';
import authRoutes from './routes/authRoutes.js';
import citizenRoutes from './routes/citizenRoutes.js';
import adminRoutes from './routes/adminRoutes.js';
import sharedRoutes from './routes/sharedRoutes.js';
import { authenticate } from './middleware/authenticate.js';
import { requirePortal } from './middleware/authorize.js';
import { apiLimiter } from './middleware/rateLimiters.js';
import { csrfGuard } from './middleware/csrfGuard.js';
import { notFound, errorHandler } from './middleware/errorHandler.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', '..', 'frontend', 'dist');
const indexHtml = path.join(distDir, 'index.html');
const hasFrontendBuild = fs.existsSync(indexHtml);

const app = express();

if (env.isProd) app.set('trust proxy', env.trustProxyHops);

// Content-Security-Policy: the browser refuses to load anything not listed here.
// useDefaults keeps Helmet's strict base, and we add only what the map and photos need:
//  - img-src: map sprites (data:/blob:) and Cloudinary photos
//  - connect-src: the OpenFreeMap tile server
//  - worker-src: MapLibre's background worker
app.use(
  helmet({
    contentSecurityPolicy: {
      useDefaults: true,
      directives: {
        'img-src': ["'self'", 'data:', 'blob:', 'https://res.cloudinary.com'],
        'connect-src': ["'self'", 'https://tiles.openfreemap.org'],
        'worker-src': ["'self'", 'blob:'],
      },
    },
  })
);
app.use(express.json({ limit: '10kb' }));
app.use(cookieParser());

// Photos saved on local disk (development only: production uses Cloudinary)
if (!env.cloudinaryUrl) {
  app.use('/uploads', express.static(UPLOAD_DIR, { maxAge: '7d' }));
  app.use('/uploads', (req, res) => res.status(404).end());
}

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
    const result = await query('SELECT PostGIS_Version() AS postgis, version() AS postgres');
    res.json({ status: 'ok', ...result.rows[0] });
  } catch (err) {
    console.error('DB health check failed:', err.message);
    res.status(500).json({ status: 'error', message: 'Database connection failed' });
  }
});

app.use('/api/auth', noStore, authRoutes);
// Data both portals may read (categories, map). Any logged-in user.
app.use('/api/shared', noStore, authenticate, sharedRoutes);
app.use('/api/citizen', noStore, authenticate, requirePortal('citizen'), citizenRoutes);
app.use('/api/admin', noStore, authenticate, requirePortal('admin'), adminRoutes);

app.use('/api', notFound);

if (hasFrontendBuild) {
  app.use(
    express.static(distDir, {
      setHeaders(res, filePath) {
        if (filePath.endsWith('index.html')) {
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.includes(`${path.sep}assets${path.sep}`)) {
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
      },
    })
  );
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') return next();
    res.set('Cache-Control', 'no-cache');
    res.sendFile(indexHtml);
  });
}

app.use(errorHandler);

export default app;