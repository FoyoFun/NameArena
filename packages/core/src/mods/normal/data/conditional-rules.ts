import type { StatId } from '../types';

/**
 * 条件能力规则表（DESIGN.md 7.4）——"没有废角色"的主力 + 图案彩蛋。
 * 全部数据驱动：新增一条特殊能力 = 这里加一行 + 一个能力文件，零框架改动。
 */
export type PatternMatcher =
  | { type: 'statBand'; stat: StatId; min: number; max: number }
  | { type: 'statBandCount'; min: number; max: number; count: number }
  | { type: 'straight'; length: number; step: number }
  | { type: 'allWithin'; range: number };

export interface ConditionalRule {
  id: string;
  match: PatternMatcher;
  /** 满足条件时自动授予的能力 id（免费，不占伪预算 cost） */
  grant: string;
  note?: string;
}

const STAT_LOW_HIGH: ReadonlyArray<{ stat: StatId; low: string; high: string }> = [
  { stat: 'str', low: 'agile-dodge', high: 'brute-force' },
  { stat: 'wis', low: 'wild-instinct', high: 'arcane-master' },
  { stat: 'vit', low: 'light-feather', high: 'iron-wall' },
  { stat: 'spr', low: 'pure-heart', high: 'mind-barrier' },
  { stat: 'agi', low: 'still-mountain', high: 'godspeed' },
  { stat: 'luk', low: 'desperate-stand', high: 'destiny-child' },
];

const rules: ConditionalRule[] = [];

// 档位规则：≤20 补偿层（温和），≥91 超凡层（放大器）。1~9 / 100+ 深渊与神话层待扩充（DESIGN.md 待办）
for (const { stat, low, high } of STAT_LOW_HIGH) {
  rules.push({ id: `${stat}-low`, match: { type: 'statBand', stat, min: 1, max: 20 }, grant: low, note: '补偿层' });
  rules.push({ id: `${stat}-high`, match: { type: 'statBand', stat, min: 91, max: 999 }, grant: high, note: '超凡层' });
}

// 图案规则：主人的"中庸之道 / 顺子 / 谁知道呢"
rules.push({
  id: 'zhongyong',
  match: { type: 'statBandCount', min: 45, max: 55, count: 4 },
  grant: 'zhongyong',
  note: '≥4 项属性落在 45~55：全概率约 0.4%，稀有但可猎',
});
rules.push({
  id: 'straight5',
  match: { type: 'straight', length: 5, step: 1 },
  grant: 'straight-five',
  note: '5 项属性构成公差 1 的顺子：天文彩票级头奖',
});
rules.push({
  id: 'balanced6',
  match: { type: 'allWithin', range: 3 },
  grant: 'balanced-six',
  note: '六维极差 ≤3：六均衡',
});

export const CONDITIONAL_RULES: ConditionalRule[] = rules;

export function matchConditional(base: Record<StatId, number>): string[] {
  const values = Object.values(base);
  const granted: string[] = [];
  for (const rule of CONDITIONAL_RULES) {
    const m = rule.match;
    let hit = false;
    switch (m.type) {
      case 'statBand': {
        const v = base[m.stat]!;
        hit = v >= m.min && v <= m.max;
        break;
      }
      case 'statBandCount': {
        const n = values.filter((v) => v >= m.min && v <= m.max).length;
        hit = n >= m.count;
        break;
      }
      case 'straight': {
        const sorted = [...values].sort((a, b) => a - b);
        for (let i = 0; i + m.length <= sorted.length; i++) {
          let ok = true;
          for (let j = 1; j < m.length; j++) {
            if (sorted[i + j]! - sorted[i + j - 1]! !== m.step) {
              ok = false;
              break;
            }
          }
          if (ok) {
            hit = true;
            break;
          }
        }
        break;
      }
      case 'allWithin': {
        hit = Math.max(...values) - Math.min(...values) <= m.range;
        break;
      }
    }
    if (hit && !granted.includes(rule.grant)) granted.push(rule.grant);
  }
  return granted;
}
