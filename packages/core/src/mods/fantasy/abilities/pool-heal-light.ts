import { defineSkill } from './define';

/** 池技能：单体治疗（目标=随机受伤友方） */
export default defineSkill({
  id: 'pool-heal-light',
  name: '治愈之光',
  kind: 'active',
  cost: 4,
  weight: 1,
  desc: '为一名受伤的友方恢复 0.7 倍攻击的生命。',
  vfx: 'heal',
  active: {
    target: 'allyInjured',
    effects: [{ type: 'heal', scale: 0.7 }],
  },
});
