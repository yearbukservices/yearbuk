import dotenv from 'dotenv';
dotenv.config();

import { randomBytes, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCallback);
const KEY_LENGTH = 64;

async function hashSecret(value: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = (await scrypt(value, salt, KEY_LENGTH)) as Buffer;
  return `scrypt:${salt}:${derivedKey.toString('hex')}`;
}

async function compareSecret(value: string, encoded: string): Promise<boolean> {
  const [algorithm, salt, hash] = encoded.split(':');
  if (algorithm !== 'scrypt' || !salt || !hash) return false;
  const expected = Buffer.from(hash, 'hex');
  const actual = (await scrypt(value, salt, expected.length)) as Buffer;
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

/**
 * Hash a password using bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return await hashSecret(password);
}

/**
 * Compare a plain text password with a hashed password
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return await compareSecret(password, hash);
}

/**
 * Hash a public upload code using bcrypt (like Zoom meeting codes)
 * Used for secure verification without exposing the plain code
 */
export async function hashUploadCode(code: string): Promise<string> {
  return await hashSecret(code);
}

/**
 * Verify a public upload code against its hash
 * Returns true if the code matches the stored hash
 */
export async function verifyUploadCode(plainCode: string, hashedCode: string): Promise<boolean> {
  try {
    return await compareSecret(plainCode, hashedCode);
  } catch (error) {
    console.error('Upload code verification error:', error);
    return false;
  }
}
