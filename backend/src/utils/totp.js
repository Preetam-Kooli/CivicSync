import * as OTPAuth from 'otpauth';
import QRCode from 'qrcode';

const ISSUER = 'CivicSync';
const PERIOD = 30; // seconds each code lives

const makeTotp = (secretBase32, label) =>
  new OTPAuth.TOTP({
    issuer: ISSUER,
    label,
    algorithm: 'SHA1', // what authenticator apps expect
    digits: 6,
    period: PERIOD,
    secret: secretBase32,
  });

// 20 random bytes (160 bits), as a base32 text string
export const generateSecret = () => new OTPAuth.Secret({ size: 20 }).base32;

// Everything the "scan this QR code" screen needs
export async function buildEnrollment(secretBase32, email) {
  const uri = makeTotp(secretBase32, email).toString();
  return {
    secret: secretBase32,
    otpauthUrl: uri,
    qrDataUrl: await QRCode.toDataURL(uri, { margin: 1, width: 220 }),
  };
}

// Returns the time-step number the code belongs to, or null if the code is wrong.
// window: 1 accepts the previous and next 30-second step too (small clock drift).
export function checkCode(secretBase32, token) {
  const delta = makeTotp(secretBase32, 'user').validate({ token, window: 1 });
  if (delta === null) return null;
  return Math.floor(Date.now() / 1000 / PERIOD) + delta;
}