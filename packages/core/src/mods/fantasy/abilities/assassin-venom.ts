import { defineSkill } from './define';

/** 刺客主动：造成伤害，中概率造成中毒或流血 */
export default defineSkill({
  id: 'assassin-venom',
  name: '淬毒之刃',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 0,
  desc: '淬毒突袭，造成 1.05 倍伤害，30% 概率使敌人中毒或流血（配合弱点洞悉叠异常增伤）。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.05 },
      { type: 'status', status: 'poison', pool: ['poison', 'bleed'], chance: 0.3, ailmentScale: 0.9, powerScaleAtk: 0.1 },
    ],
  },
});
