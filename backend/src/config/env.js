import 'dotenv/config';

function required(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required environment variable: ${name}`);
    process.exit(1);
  }
  return value;
}

const jwtAccessSecret = required('JWT_ACCESS_SECRET');
if (jwtAccessSecret.length < 32) {
  console.error('JWT_ACCESS_SECRET must be at least 32 characters long');
  process.exit(1);
}

const totpEncryptionKey = required('TOTP_ENCRYPTION_KEY');
if (!/^[0-9a-fA-F]{64}$/.test(totpEncryptionKey)) {
  console.error('TOTP_ENCRYPTION_KEY must be exactly 64 hex characters');
  process.exit(1);
}

const isProd = process.env.NODE_ENV === 'production';

const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1 || trustProxyHops > 5) {
  console.error('TRUST_PROXY_HOPS must be a whole number from 1 to 5');
  process.exit(1);
}

// Photos go to Cloudinary in production (server disks are not permanent).
// Locally, when this is empty, photos are saved in backend/uploads instead.
const cloudinaryUrl = process.env.CLOUDINARY_URL || null;
if (isProd && !cloudinaryUrl) {
  console.error('CLOUDINARY_URL is required in production');
  process.exit(1);
}

// Optional (Phase 6): lets an outside timer trigger the SLA job on a sleeping free server
const cronSecret = process.env.CRON_SECRET || null;
if (cronSecret && cronSecret.length < 24) {
  console.error('CRON_SECRET must be at least 24 characters long');
  process.exit(1);
}
// Testing only: pretend the next 24 hours bring this many mm of rain. Always ignored in production.
const simulated = process.env.WEATHER_SIMULATE_MM;
const weatherSimulateMm = !isProd && simulated !== undefined && simulated !== '' ? Number(simulated) : null;
if (weatherSimulateMm !== null && !(weatherSimulateMm >= 0)) {
  console.error('WEATHER_SIMULATE_MM must be a number of 0 or more');
  process.exit(1);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  jwtAccessSecret,
  totpEncryptionKey,
  clientOrigin: process.env.CLIENT_ORIGIN || (isProd ? null : 'http://localhost:5173'),
  trustProxyHops,
  cloudinaryUrl,
  cronSecret,
  weatherSimulateMm,
};