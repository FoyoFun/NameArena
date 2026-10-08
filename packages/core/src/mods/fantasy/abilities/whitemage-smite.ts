import { defineSkill } from './define';

/** 白魔导师主动：造成伤害，一定概率眩晕 */
export default defineSkill({
  id: 'whitemage-smite',
  name: '圣惩',
  kind: 'active',
  label: 'common',
  cost: 4,
  weight: 0,
  desc: '以圣光惩戒敌人，造成 1.0 倍伤害，10% 概率眩晕。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.0 },
      { type: 'status', status: 'stun', chance: 0.1, ailmentScale: 0.35 },
    ],
  },
});
