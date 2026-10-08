import { defineSkill } from './define';

/** 池技能：吟唱伤害 + 概率冰冻（魔法控制） */
export default defineSkill({
  id: 'pool-glaciate',
  name: '冰结术',
  kind: 'active',
  label: 'magic',
  cost: 5,
  weight: 1,
  desc: '吟唱 500 后造成 1.2 倍伤害，20% 概率冰冻敌人一回合。',
  vfx: 'fireball',
  active: {
    target: 'enemy',
    cast: { base: 500, rollMax: 0 },
    effects: [
      { type: 'damage', scale: 1.2 },
      { type: 'status', status: 'freeze', chance: 0.2, ailmentScale: 0.4 },
    ],
  },
});
