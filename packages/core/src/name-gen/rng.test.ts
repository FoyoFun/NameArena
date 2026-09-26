import { describe, expect, it } from 'vitest';
import { battleSeed, hashString, makeRng, nameSeed } from './rng';

describe('Rng 确定性', () => {
  it('同种子同序列', () => {
    const a = makeRng(42);
    const b = makeRng(42);
    const seqA = Array.from({ length: 20 }, () => a.next());
    const seqB = Array.from({ length: 20 }, () => b.next());
    expect(seqA).toEqual(seqB);
  });

  it('不同种子不同序列', () => {
    const a = makeRng(1);
    const b = makeRng(2);
    expect(Array.from({ length: 10 }, () => a.next())).not.toEqual(
      Array.from({ length: 10 }, () => b.next()),
    );
  });

  it('int 闭区间、weighted 零权重剔除、shuffle 不改原数组', () => {
    const rng = makeRng(7);
    for (let i = 0; i < 100; i++) {
      const v = rng.int(1, 6);
      expect(v).toBeGreaterThanOrEqual(1);
      expect(v).toBeLessThanOrEqual(6);
    }
    expect(rng.weighted([{ item: 'a', weight: 0 }, { item: 'b', weight: 1 }])).toBe('b');
    const arr = [1, 2, 3];
    rng.shuffle(arr);
    expect(arr).toEqual([1, 2, 3]);
  });
});

describe('种子派生', () => {
  it('同名同模组同版本 ⇒ 同种子；任何一项不同 ⇒ 不同种子', () => {
    expect(nameSeed('张三', 'normal-pvp', 1)).toBe(nameSeed('张三', 'normal-pvp', 1));
    expect(nameSeed('张三', 'normal-pvp', 1)).not.toBe(nameSeed('张三', 'normal-pve', 1));
    expect(nameSeed('张三', 'normal-pvp', 1)).not.toBe(nameSeed('张三', 'normal-pvp', 2));
    expect(nameSeed('张三', 'normal-pvp', 1)).not.toBe(nameSeed('张四', 'normal-pvp', 1));
    // 大小写敏感
    expect(nameSeed('abc', 'm', 1)).not.toBe(nameSeed('ABC', 'm', 1));
  });

  it('battleSeed：entropy 改变种子', () => {
    const cfg = '{"modId":"normal-pvp"}';
    expect(battleSeed(cfg)).toBe(battleSeed(cfg));
    expect(battleSeed(cfg)).not.toBe(battleSeed(cfg, 1));
    expect(battleSeed(cfg, 1)).toBe(battleSeed(cfg, 1));
  });

  it('hashString 稳定且为 uint32', () => {
    expect(hashString('hello')).toBe(hashString('hello'));
    expect(hashString('')).toBe(0x811c9dc5);
  });
});
