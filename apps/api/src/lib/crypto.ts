import { randomBytes, scrypt as scryptCallback, timingSafeEqual, createHash } from 'node:crypto';
import { promisify } from 'node:util';
const scrypt = promisify(scryptCallback);
export const hashToken = (value: string) => createHash('sha256').update(value).digest('hex');
export async function hashPassword(password: string) { const salt = randomBytes(16).toString('hex'); const key = await scrypt(password,salt,64) as Buffer; return `scrypt:${salt}:${key.toString('hex')}`; }
export async function verifyPassword(password: string, encoded: string) { const [algorithm,salt,key] = encoded.split(':'); if (algorithm !== 'scrypt' || !salt || !key) return false; const derived = await scrypt(password,salt,64) as Buffer; const expected = Buffer.from(key,'hex'); return expected.length === derived.length && timingSafeEqual(expected,derived); }
