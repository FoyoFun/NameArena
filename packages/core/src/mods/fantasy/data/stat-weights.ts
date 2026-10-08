import { FORMULAS } from './formulas';
import type { CombatKey, DerivedStats, SixStats } from '../types';

/**
 * 六维 → 十二战斗属性 的连续映射（DESIGN-FANTASY.md §3.2，Q1/F1 裁定）。
 *
 * wHigh(x) / wLow(x) 是同一根杠杆的两端：50 → 各 0.5（中庸同时拥有还不错的两者），
 * 90+ → 高端满档并次线性放大（头奖），1~9 → 低端深渊微放大。
 * 映射矩阵给出"满档量"，实际收益 = 满档量 × 权重，逐项叠加到基础值上。
 *
 * F53 调参教训：满档量过大时，常规档（10~89）内的属性差会被线性放大成碾压
 * （20 vs 80 也是 0:100）。满档量减半、基础值做主，让六维决定"倾向"而非"生死"；
 * 极端档（91+ / 1~9）靠 √ 放大和深渊放大保留头奖/地狱的节目效果。
 */

export const BASE_DERIVED: DerivedStats = {
  atk: 130,
  def: 90,
  spd: 100,
  maxHp: 830,
  crit: 0.05,
  hit: 0.5,
  dodge: 0.1,
  resist: 0.25,
  absorb: 0.25,
  destiny: 0,
  ailment: 0,
};

/** 高端权重：10→0 线性升至 90→1；90 后按 √ 次线性放大（999 ≈ 1.94+√） */
export function wHigh(x: number): number {
  const base = Math.min(1, Math.max(0, (x - 10) / 80));
  const over = Math.max(0, x - 90);
  return base + Math.sqrt(over) * FORMULAS.wHighSqrtCoef;
}

/** 低端权重：90→0 线性降至 10→1；10 以下深渊层每点微放大（1 ≈ 1.27+） */
export function wLow(x: number): number {
  const base = Math.min(1, Math.max(0, (90 - x) / 80));
  return base + Math.max(0, 10 - x) * FORMULAS.wLowAbyssCoef;
}

type Mapping = Partial<Record<CombatKey, number>>;

/**
 * 主人的高低映射表 v2（2026-10-08 群友反馈改版，F49）：
 * 每个属性的主导收益清晰可读——"力量高攻击就高"符合直觉；交叉收益收敛到少量补偿项。
 * +++/++/+ 表示满档量级。精神低不再给天选（F48：天选只来自幸运高）。
 */
export const STAT_MAPPING: Record<keyof SixStats, { high: Mapping; low: Mapping }> = {
  // 力量高：攻击+++；力量低：异常率++
  str: {
    high: { atk: 100 },
    low: { ailment: 0.22 },
  },
  // 体质高：HP++、防+；体质低：吸收率++
  vit: {
    high: { maxHp: 300, def: 25 },
    low: { absorb: 0.3 },
  },
  // 智力高：攻击+、异常率++；智力低：命中率++、抵抗率+
  int: {
    high: { atk: 45, ailment: 0.22 },
    low: { hit: 0.3, resist: 0.16 },
  },
  // 精神高：防++、抵抗率+；精神低：吸收率+、异常率+
  spr: {
    high: { def: 45, resist: 0.22 },
    low: { absorb: 0.18, ailment: 0.16 },
  },
  // 敏捷高：速度++、暴击/闪避/命中+；敏捷低：抵抗率+、吸收率+
  agi: {
    high: { spd: 30, crit: 0.14, dodge: 0.1, hit: 0.1 },
    low: { resist: 0.12, absorb: 0.1 },
  },
  // 幸运高：天选++；幸运低：其他所有属性+（F53 调参：低幸运是"全能补偿"，
  // 承担"没有废角色"的兜底，避免属性差被放大成碾压）
  luk: {
    high: { destiny: 220 },
    low: { atk: 45, def: 30, spd: 8, maxHp: 280, crit: 0.04, dodge: 0.04, hit: 0.12, resist: 0.04, absorb: 0.04, ailment: 0.05 },
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
