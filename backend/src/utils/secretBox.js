import crypto from 'node:crypto';
import { env } from '../config/env.js';

// AES-256-GCM encrypts AND authenticates: tampered data fails to decrypt.
const key = Buffer.from(env.totpEncryptionKey, 'hex');

export function encrypt(plain) {
  const iv = crypto.randomBytes(12); // a fresh random value for every encryption
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, data].map((b) => b.toString('base64')).join('.');
}

export function decrypt(stored) {
  const [iv, tag, data] = stored.split('.').map((p) => Buffer.from(p, 'base64'));
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
}