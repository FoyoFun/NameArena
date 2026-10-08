import { defineSkill } from './define';

/** 吟游诗人主动：造成伤害，极小概率造成流血或中毒（基础概率低，异常率影响大） */
export default defineSkill({
  id: 'bard-hymn',
  name: '破邪之歌',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 0,
  desc: '歌声蕴藏杀意：造成 1.15 倍伤害，6% 概率使敌人流血或中毒（异常率对此技影响极大）。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.15 },
      { type: 'status', status: 'bleed', pool: ['bleed', 'poison'], chance: 0.06, ailmentScale: 1.2, powerScaleAtk: 0.1 },
    ],
  },
});
