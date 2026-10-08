import type { PetDef } from '../types';

/**
 * 召唤物数据表（DESIGN-FANTASY.md §3.3）。属性由召唤者快照派生 + 固定附加。
 * 一期引擎机制位就绪，猎人职业与更多宠物二期实装。
 */
export const PETS: Record<string, PetDef> = {
  hound: {
    id: 'hound',
    name: '猎犬',
    // F53 调参：1v1 里猎犬=2v1 优势过大，派生压缩到 5 折上下
    derive: { atk: 0.5, def: 0.4, spd: 0.8, maxHp: 0.4 },
    fixed: { crit: 0.15, hit: 0.5, dodge: 0.1, resist: 0.25, absorb: 0.25 },
    hate: 600,
    skills: ['hound-bite'],
  },
};
