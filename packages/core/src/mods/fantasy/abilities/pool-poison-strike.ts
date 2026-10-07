import { defineSkill } from './define';

/** 池技能：攻击 + 概率中毒（物理） */
export default defineSkill({
  id: 'pool-poison-strike',
  name: '淬毒打击',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 1,
  desc: '造成 1.0 倍伤害，35% 概率使敌人中毒（每跳 10% 攻击）。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.0 },
      { type: 'status', status: 'poison', chance: 0.35, powerScaleAtk: 0.1 },
    ],
  },
});
