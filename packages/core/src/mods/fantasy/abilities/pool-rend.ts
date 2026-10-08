import { defineSkill } from './define';

/** 池技能：攻击 + 概率流血（物理，百分比 DoT） */
export default defineSkill({
  id: 'pool-rend',
  name: '裂伤斩',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 1,
  desc: '造成 1.0 倍伤害，22% 概率使敌人流血（每跳损失当前生命的 4%）。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.0 },
      { type: 'status', status: 'bleed', chance: 0.22 },
    ],
  },
});
