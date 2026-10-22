import { hashPassword, verifyPassword } from './password.util.js';

describe('password.util', () => {
  describe('hashPassword', () => {
    it('生成 salt:hash 格式的密文', async () => {
      const stored = await hashPassword('Passw0rd');

      // salt 16 字节 hex(32) + ':' + scrypt 64 字节 hex(128)
      expect(stored).toMatch(/^[0-9a-f]{32}:[0-9a-f]{128}$/);
    });

    it('相同明文两次哈希结果不同（随机 salt）', async () => {
      const first = await hashPassword('Passw0rd');
      const second = await hashPassword('Passw0rd');

      expect(first).not.toBe(second);
    });

    it('密文中不包含明文', async () => {
      const stored = await hashPassword('Passw0rd');

      expect(stored).not.toContain('Passw0rd');
    });
  });

  describe('verifyPassword', () => {
    it('明文正确时返回 true', async () => {
      const stored = await hashPassword('Passw0rd');

      await expect(verifyPassword('Passw0rd', stored)).resolves.toBe(true);
    });

    it('明文错误时返回 false', async () => {
      const stored = await hashPassword('Passw0rd');

      await expect(verifyPassword('wrong-password', stored)).resolves.toBe(false);
    });

    it('大小写敏感', async () => {
      const stored = await hashPassword('Passw0rd');

      await expect(verifyPassword('passw0rd', stored)).resolves.toBe(false);
    });

    it('密文格式非法时返回 false 而不抛错', async () => {
      await expect(verifyPassword('x', 'not-a-valid-hash')).resolves.toBe(false);
      await expect(verifyPassword('x', '')).resolves.toBe(false);
    });

    it('哈希长度不匹配时返回 false（防越界比较）', async () => {
      const stored = await hashPassword('Passw0rd');
      const [salt] = stored.split(':');

      await expect(verifyPassword('Passw0rd', `${salt}:00ff`)).resolves.toBe(false);
    });
  });
});
