import { createHash, scrypt, timingSafeEqual, webcrypto } from 'node:crypto';
import { promisify } from 'node:util';

const deriveScrypt = promisify(scrypt);
const scryptOptions = { N: 32_768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };

const digest = value => createHash('sha256').update(value).digest();
export const same = (a, b) => timingSafeEqual(digest(a), digest(b));

export async function passwordHash(password, salt, storedHash) {
  const saltBytes = Buffer.from(salt, 'hex');
  if (storedHash === undefined || storedHash.startsWith('scrypt$')) {
    const hash = await deriveScrypt(password, saltBytes, 32, scryptOptions);
    return 'scrypt$' + hash.toString('hex');
  }

  // Verify unprefixed PBKDF2 hashes created by earlier releases.
  const key = await webcrypto.subtle.importKey('raw', Buffer.from(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await webcrypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256',
    salt: saltBytes, iterations: 600_000 }, key, 256);
  return Buffer.from(bits).toString('hex');
}
