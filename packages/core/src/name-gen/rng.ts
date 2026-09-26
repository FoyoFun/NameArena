/**
 * 种子随机器与 hash 工具。
 * 铁律：引擎与模组内禁止 Math.random，一切随机走 Rng。
 */

export interface Rng {
  /** 种子（只读，用于调试/展示） */
  readonly seed: number;
  /** [0, 1) */
  next(): number;
  /** [min, max] 闭区间整数 */
  int(min: number, max: number): number;
  /** 真值概率 p ∈ [0,1] */
  chance(p: number): boolean;
  pick<T>(arr: readonly T[]): T;
  weighted<T>(entries: readonly { item: T; weight: number }[]): T;
  shuffle<T>(arr: readonly T[]): T[];
}

/** mulberry32：小、快、质量足够游戏使用 */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  const next = (): number => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const rng: Rng = {
    seed,
    next,
    int(min, max) {
      return min + Math.floor(next() * (max - min + 1));
    },
    chance(p) {
      return next() < p;
    },
    pick(arr) {
      if (arr.length === 0) throw new Error('rng.pick: empty array');
      return arr[Math.floor(next() * arr.length)]!;
    },
    weighted(entries) {
      const usable = entries.filter((e) => e.weight > 0);
      if (usable.length === 0) throw new Error('rng.weighted: no positive weight');
      const total = usable.reduce((s, e) => s + e.weight, 0);
      let roll = next() * total;
      for (const e of usable) {
        roll -= e.weight;
        if (roll < 0) return e.item;
      }
      return usable[usable.length - 1]!.item;
    },
    shuffle(arr) {
      const out = [...arr];
      for (let i = out.length - 1; i > 0; i--) {
        const j = Math.floor(next() * (i + 1));
        [out[i], out[j]] = [out[j]!, out[i]!];
      }
      return out;
    },
  };
  return rng;
}

/** FNV-1a 32 位 */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** 角色种子 = hash(校验后名字 + 模组id + 生成器版本号)。同名同模组同版本必得同种子。 */
export function nameSeed(name: string, modId: string, genVersion: number): number {
  return hashString(`${name}|${modId}|${genVersion}`);
}

/** 战斗种子：配置相同 + entropy 不同 ⇒ 结果不同；都不变 ⇒ 完全可重演 */
export function battleSeed(configJson: string, entropy?: number): number {
  return entropy === undefined ? hashString(configJson) : hashString(`${configJson}|${entropy}`);
}
