import { defineSkill } from './define';

/** 池技能：HOT（持续回血，靠吸收判定维持） */
export default defineSkill({
  id: 'pool-rejuvenation',
  name: '回春颂',
  kind: 'active',
  cost: 4,
  weight: 1,
  desc: '为一名受伤的友方注入回春之力：每回合恢复 12% 攻击的生命。',
  vfx: 'heal',
  active: {
    target: 'allyInjured',
    effects: [{ type: 'status', status: 'regen', chance: 1, powerScaleAtk: 0.12 }],
  },
});
