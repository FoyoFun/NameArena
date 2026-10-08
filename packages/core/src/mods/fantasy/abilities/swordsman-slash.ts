import { defineSkill } from './define';

/** 剑士主动：造成伤害，小概率使敌人流血 */
export default defineSkill({
  id: 'swordsman-slash',
  name: '斩铁闪',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 0,
  desc: '凌厉一闪，造成 1.1 倍伤害，16% 概率使敌人流血（每跳损失当前生命的 4%）。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.1 },
      { type: 'status', status: 'bleed', chance: 0.16, ailmentScale: 0.8 },
    ],
  },
});
