import { createHash, timingSafeEqual, webcrypto } from 'node:crypto';

const digest = value => createHash('sha256').update(value).digest();
export const same = (a, b) => timingSafeEqual(digest(a), digest(b));

export async function passwordHash(password, salt) {
  const key = await webcrypto.subtle.importKey('raw', Buffer.from(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256',
    salt: Buffer.from(salt, 'hex'), iterations: 600_000 }, key, 256);
  return Buffer.from(bits).toString('hex');
}
