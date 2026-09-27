/**
 * 性格（DESIGN.md 7.8）。
 * ⚠️ 保底铁律（主人要求）：性格只调倾向，永不废人——
 * 1. 所有类别乘数必须落在 [0.7, 1.4]，任何性格不禁用任何行为类别；
 * 2. AI 每个行动槽必须行动（眩晕除外），普攻永远可用兜底；
 * 3. 性格只改变"先做什么、先打谁"。
 */
export interface Personality {
  id: string;
  name: string;
  emoji: string;
  desc: string;
  mult: { attack: number; heal: number; buff: number; control: number };
  /** 打分随机噪声幅度（搞事性格更大，偶尔整活） */
  noise: number;
}

export const PERSONALITIES: Personality[] = [
  {
    id: 'aggressive',
    name: '激进',
    emoji: '🔥',
    desc: '先砍再说，治疗随缘',
    mult: { attack: 1.4, heal: 0.7, buff: 0.7, control: 1.0 },
    noise: 0.1,
  },
  {
    id: 'conservative',
    name: '保守',
    emoji: '🛡️',
    desc: '先保命后输出，奶量优先',
    mult: { attack: 0.7, heal: 1.4, buff: 1.3, control: 0.9 },
    noise: 0.1,
  },
  {
    id: 'chaotic',
    name: '搞事',
    emoji: '🎲',
    desc: '控制与削弱优先，行为不可预测',
    mult: { attack: 0.9, heal: 0.8, buff: 1.0, control: 1.4 },
    noise: 0.35,
  },
  {
    id: 'steady',
    name: '沉稳',
    emoji: '⚖️',
    desc: '按最优解行动，稳定发挥',
    mult: { attack: 1.0, heal: 1.0, buff: 1.0, control: 1.0 },
    noise: 0.05,
  },
];

export const PERSONALITY_MAP = new Map(PERSONALITIES.map((p) => [p.id, p]));

/** 性格乘数合法性自检：违反 [0.7, 1.4] 直接抛错（防止未来新增性格违反铁律） */
export function assertPersonalitySafe(): void {
  for (const p of PERSONALITIES) {
    for (const v of Object.values(p.mult)) {
      if (v < 0.7 || v > 1.4) {
        throw new Error(`性格「${p.name}」乘数 ${v} 越界 [0.7, 1.4]，违反性格保底铁律`);
      }
    }
  }
}
