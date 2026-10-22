import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const KEY_LENGTH = 64;

/** 使用 Node 内置 scrypt 加密，零外部依赖，避免 bcrypt 的原生编译问题 */
function scryptAsync(password: string, salt: string, keylen: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, keylen, (err, derivedKey) => {
      if (err) reject(err);
      else resolve(derivedKey);
    });
  });
}

/** 生成 `salt:hash` 格式的密文 */
export async function hashPassword(plain: string): Promise<string> {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = await scryptAsync(plain, salt, KEY_LENGTH);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/** 校验明文与 `salt:hash` 密文是否匹配 */
export async function verifyPassword(plain: string, stored: string): Promise<boolean> {
  const [salt, hash] = stored.split(':');
  if (!salt || !hash) return false;

  const derivedKey = await scryptAsync(plain, salt, KEY_LENGTH);
  const expected = Buffer.from(hash, 'hex');
  if (expected.length !== derivedKey.length) return false;

  // 定长比较，避免时序攻击
  return timingSafeEqual(expected, derivedKey);
}
