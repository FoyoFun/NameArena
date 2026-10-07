import { defineSkill } from './define';

/** 药师主动：恢复生命值（治疗强度 = 攻击） */
export default defineSkill({
  id: 'apothecary-elixir',
  name: '灵药',
  kind: 'active',
  cost: 4,
  weight: 0,
  desc: '调制灵药，为一名受伤的友方恢复 0.5 倍攻击的生命。',
  vfx: 'heal',
  active: {
    target: 'allyInjured',
    effects: [{ type: 'heal', scale: 0.5 }],
  },
});
