import { defineSkill } from './define';

/** 池技能：吸血攻击（物理） */
export default defineSkill({
  id: 'pool-vampiric-fang',
  name: '吸血獠牙',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 1,
  desc: '撕咬造成 0.9 倍伤害，并将 50% 伤害转换为自身生命。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    drainRatio: 0.5,
    effects: [{ type: 'damage', scale: 0.9 }],
  },
});
