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

const isProd = process.env.NODE_ENV === 'production';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  jwtAccessSecret,
  // The Vite dev server's address. In production the app and API share one
  // address, so no extra origin needs trusting.
  clientOrigin: process.env.CLIENT_ORIGIN || (isProd ? null : 'http://localhost:5173'),
};