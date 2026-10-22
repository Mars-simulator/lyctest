import { bigintTransformer, centsToYuan, yuanToCents } from './money.util.js';

describe('money.util', () => {
  describe('centsToYuan', () => {
    it('整数金额补齐两位小数', () => {
      expect(centsToYuan(0)).toBe('0.00');
      expect(centsToYuan(5)).toBe('0.05');
      expect(centsToYuan(100)).toBe('1.00');
      expect(centsToYuan(123456)).toBe('1234.56');
    });

    it('负数保留符号', () => {
      expect(centsToYuan(-5)).toBe('-0.05');
      expect(centsToYuan(-12345)).toBe('-123.45');
    });
  });

  describe('yuanToCents', () => {
    it('按四舍五入转换为分，规避浮点误差', () => {
      expect(yuanToCents(0.1)).toBe(10);
      expect(yuanToCents(19.99)).toBe(1999);
      // 0.1 + 0.2 的浮点误差不应影响结果
      expect(yuanToCents(0.1 + 0.2)).toBe(30);
    });
  });

  describe('bigintTransformer', () => {
    it('读取时把数据库返回的字符串转为 number', () => {
      expect(bigintTransformer.from('123456')).toBe(123456);
      expect(bigintTransformer.from(null)).toBeNull();
    });

    it('写入时原样传递数值', () => {
      expect(bigintTransformer.to(123456)).toBe(123456);
      expect(bigintTransformer.to(null)).toBeNull();
      expect(bigintTransformer.to(undefined)).toBeNull();
    });
  });
});
