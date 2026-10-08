import { defineSkill } from './define';

/** 池技能：吟唱伤害 + 概率灼烧（魔法） */
export default defineSkill({
  id: 'pool-scorch',
  name: '灼热术',
  kind: 'active',
  label: 'magic',
  cost: 5,
  weight: 1,
  desc: '吟唱 400 后造成 1.4 倍伤害，25% 概率灼烧（每跳 15% 攻击）。',
  vfx: 'fireball',
  active: {
    target: 'enemy',
    cast: { base: 400, rollMax: 0 },
    effects: [
      { type: 'damage', scale: 1.4 },
      { type: 'status', status: 'burn', chance: 0.25, ailmentScale: 0.9, powerScaleAtk: 0.15 },
    ],
  },
});
