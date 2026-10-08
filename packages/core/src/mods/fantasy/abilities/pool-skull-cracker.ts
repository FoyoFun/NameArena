import { defineSkill } from './define';

/** 池技能：攻击 + 概率眩晕（通用） */
export default defineSkill({
  id: 'pool-skull-cracker',
  name: '重锤',
  kind: 'active',
  label: 'common',
  cost: 4,
  weight: 1,
  desc: '造成 1.1 倍伤害，15% 概率眩晕敌人一回合。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.1 },
      { type: 'status', status: 'stun', chance: 0.15, ailmentScale: 0.35 },
    ],
  },
});
