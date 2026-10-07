import { defineSkill } from './define';

/** 刺客主动：造成伤害，中概率造成中毒或流血 */
export default defineSkill({
  id: 'assassin-venom',
  name: '淬毒之刃',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 0,
  desc: '淬毒突袭，造成 0.9 倍伤害，40% 概率使敌人中毒或流血。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 0.9 },
      { type: 'status', status: 'poison', pool: ['poison', 'bleed'], chance: 0.4, powerScaleAtk: 0.1 },
    ],
  },
});
