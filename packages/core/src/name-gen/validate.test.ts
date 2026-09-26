import { describe, expect, it } from 'vitest';
import { validateName } from './validate';

describe('validateName（拒绝制）', () => {
  it('合法：中文、英文、数字、混合、大小写敏感', () => {
    for (const n of ['张三', 'Alice', 'alice', 'Zaker556', '王小明2', 'a', '0', '龘']) {
      const r = validateName(n);
      expect(r.ok, `${n} 应合法`).toBe(true);
    }
    // trim 后合法
    expect(validateName('  张三  ')).toEqual({ ok: true, name: '张三' });
  });

  it('拒绝：空、纯空格、超长', () => {
    expect(validateName('').ok).toBe(false);
    expect(validateName('   ').ok).toBe(false);
    expect(validateName('a'.repeat(17)).ok).toBe(false);
    expect(validateName('一'.repeat(16)).ok).toBe(true);
  });

  it('拒绝：符号、换行、空格、全角英文数字、假名', () => {
    expect(validateName('张三!').ok).toBe(false);
    expect(validateName('张·三').ok).toBe(false);
    expect(validateName('张\n三').ok).toBe(false);
    expect(validateName('张 三').ok).toBe(false);
    expect(validateName('Ｚａｋｅｒ').ok).toBe(false); // 全角英文
    expect(validateName('１２３').ok).toBe(false); // 全角数字
    expect(validateName('ああ').ok).toBe(false); // 假名不是汉字
    expect(validateName('😀').ok).toBe(false);
  });

  it('大小写算不同名字（大小写敏感）', () => {
    // 这里只验证都不合法于"互化"：校验器不转换，原样通过
    expect(validateName('ABC')).toEqual({ ok: true, name: 'ABC' });
    expect(validateName('abc')).toEqual({ ok: true, name: 'abc' });
  });
});
