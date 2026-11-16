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

// How many proxies sit between the internet and our server (see app.js)
const trustProxyHops = Number.parseInt(process.env.TRUST_PROXY_HOPS ?? '1', 10);
if (!Number.isInteger(trustProxyHops) || trustProxyHops < 1 || trustProxyHops > 5) {
  console.error('TRUST_PROXY_HOPS must be a whole number from 1 to 5');
  process.exit(1);
}

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd,
  jwtAccessSecret,
  // The Vite dev server's address. In production the app and API share one
  // address, so no extra origin needs trusting.
  clientOrigin: process.env.CLIENT_ORIGIN || (isProd ? null : 'http://localhost:5173'),
  trustProxyHops,
};