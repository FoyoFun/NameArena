import { FORMULAS } from './formulas';
import type { CombatKey, DerivedStats, SixStats } from '../types';

/**
 * 六维 → 十二战斗属性 的连续映射（DESIGN-FANTASY.md §3.2，Q1/F1 裁定）。
 *
 * wHigh(x) / wLow(x) 是同一根杠杆的两端：50 → 各 0.5（中庸同时拥有还不错的两者），
 * 90+ → 高端满档并次线性放大（头奖），1~9 → 低端深渊微放大。
 * 映射矩阵给出"满档量"，实际收益 = 满档量 × 权重，逐项叠加到基础值上。
 */

export const BASE_DERIVED: DerivedStats = {
  atk: 115,
  def: 90,
  spd: 100,
  maxHp: 960,
  crit: 0.05,
  hit: 0.5,
  dodge: 0.1,
  resist: 0.25,
  absorb: 0.25,
  destiny: 0,
  ailment: 0,
};

/** 高端权重：10→0 线性升至 90→1；90 后按 √ 次线性放大（999 ≈ 1.94） */
export function wHigh(x: number): number {
  const base = Math.min(1, Math.max(0, (x - 10) / 80));
  const over = Math.max(0, x - 90);
  return base + Math.sqrt(over) * FORMULAS.wHighSqrtCoef;
}

/** 低端权重：90→0 线性降至 10→1；10 以下深渊层每点微放大（1 ≈ 1.27） */
export function wLow(x: number): number {
  const base = Math.min(1, Math.max(0, (90 - x) / 80));
  return base + Math.max(0, 10 - x) * FORMULAS.wLowAbyssCoef;
}

type Mapping = Partial<Record<CombatKey, number>>;

/** 主人的高低映射表（DESIGN-FANTASY.md §3.2 矩阵）：满档量 */
export const STAT_MAPPING: Record<keyof SixStats, { high: Mapping; low: Mapping }> = {
  str: {
    high: { atk: 90, def: 25, hit: 0.15 },
    low: { spd: 30, dodge: 0.12, ailment: 0.18 },
  },
  vit: {
    high: { maxHp: 420, def: 45, resist: 0.15 },
    low: { atk: 55, dodge: 0.1, crit: 0.28 },
  },
  int: {
    high: { atk: 55, crit: 0.12, dodge: 0.1, ailment: 0.1 },
    low: { maxHp: 340, def: 45, resist: 0.4, absorb: 0.2, hit: 0.25 },
  },
  spr: {
    high: { resist: 0.18, def: 45, absorb: 0.18 },
    low: { atk: 45, spd: 20, destiny: 240 },
  },
  agi: {
    high: { spd: 55, crit: 0.25, dodge: 0.15, hit: 0.15, ailment: 0.1 },
    low: { maxHp: 270, def: 40, atk: 70 },
  },
  luk: {
    high: { destiny: 260 },
    low: { atk: 10, def: 8, spd: 6, maxHp: 50, crit: 0.03, dodge: 0.03, hit: 0.1, resist: 0.03, absorb: 0.03, ailment: 0.03 },
  },
};

/** 六维 → 派生（不含职业补正）。百分比属性在此不钳制，战斗取值时统一钳（F26）。 */
export function computeDerived(base: SixStats): DerivedStats {
  const out: DerivedStats = { ...BASE_DERIVED };
  for (const stat of Object.keys(base) as (keyof SixStats)[]) {
    const x = base[stat];
    const hi = wHigh(x);
    const lo = wLow(x);
    for (const [k, v] of Object.entries(STAT_MAPPING[stat].high) as [CombatKey, number][]) {
      out[k] += v * hi;
    }
    for (const [k, v] of Object.entries(STAT_MAPPING[stat].low) as [CombatKey, number][]) {
      out[k] += v * lo;
    }
  }
  return out;
}
