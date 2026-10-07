import { defineSkill } from './define';

/** 战士主动：造成伤害并将一部分伤害转换为生命 */
export default defineSkill({
  id: 'warrior-bloodstrike',
  name: '血怒斩',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 0,
  desc: '怒意挥斩，造成 1.2 倍伤害，并将 40% 伤害转换为生命。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    drainRatio: 0.4,
    effects: [{ type: 'damage', scale: 1.2 }],
  },
});
