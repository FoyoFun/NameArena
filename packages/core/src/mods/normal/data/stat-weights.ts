import type { DerivedKey, SixStats, StatId } from '../types';

/**
 * 派生属性权重表（DESIGN.md 7.1）。
 * 主人的六维语义直接编码为这张表：派生 = base + Σ(六维 × 权重)。
 * 改语义 = 改表；所有公式连续，保证 50 与 51 必有区别。
 */
export interface WeightRow {
  base?: number;
  w: Partial<Record<StatId, number>>;
}

export const STAT_WEIGHTS: Record<DerivedKey, WeightRow> = {
  // 力量：大量物理攻击；幸运：少量一切
  atk: { w: { str: 1.0, luk: 0.1 } },
  // 智慧：大量魔法攻击（兼治疗强度）
  mag: { w: { wis: 1.0, luk: 0.1 } },
  // 体力：大量HP；精神/力量：少量HP
  maxHp: { base: 80, w: { str: 0.5, vit: 8, spr: 1, luk: 0.3 } },
  // 智慧/精神：中量MP
  maxMp: { base: 20, w: { wis: 3, spr: 3, luk: 0.2 } },
  // 体力：中量物防；精神：少量
  pdef: { w: { vit: 0.8, spr: 0.15, luk: 0.1 } },
  // 精神：中量魔防；体力：少量
  mdef: { w: { vit: 0.2, spr: 0.6, luk: 0.1 } },
  // 敏捷：中量闪避（小数概率）
  dodge: { w: { agi: 0.0015, luk: 0.0005 } },
  // 敏捷：中量暴击（上限见 FORMULAS.critCap）
  crit: { w: { agi: 0.0018, luk: 0.0008 } },
  // 敏捷：中量暴伤（倍率，基础 150%）
  critDmg: { base: 1.5, w: { agi: 0.002, luk: 0.001 } },
  // 敏捷：先攻主属性；幸运少量
  spd: { w: { agi: 1.0, luk: 0.2 } },
};

export function computeDerived(base: SixStats): Record<DerivedKey, number> {
  const out = {} as Record<DerivedKey, number>;
  for (const key of Object.keys(STAT_WEIGHTS) as DerivedKey[]) {
    const row = STAT_WEIGHTS[key]!;
    let v = row.base ?? 0;
    for (const [stat, weight] of Object.entries(row.w) as [StatId, number][]) {
      v += base[stat] * weight;
    }
    out[key] = v;
  }
  return out;
}
