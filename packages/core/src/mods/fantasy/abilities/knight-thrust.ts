import { defineSkill } from './define';

/** 骑士主动：造成伤害，小概率眩晕 */
export default defineSkill({
  id: 'knight-thrust',
  name: '荣光突刺',
  kind: 'active',
  label: 'common',
  cost: 4,
  weight: 0,
  desc: '以荣光贯刺敌人，造成 1.0 倍伤害，15% 概率眩晕。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.0 },
      { type: 'status', status: 'stun', chance: 0.15, ailmentScale: 0.5 },
    ],
  },
});
