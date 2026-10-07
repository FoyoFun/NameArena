import { defineSkill } from './define';
import { applyRandomStatusFromPool } from '../rules/ai';
import { pickAlly } from '../rules/targeting';
import { RANDOM_BUFF_POOL } from '../data/statuses';

const CHANCE = 0.35;

/** 吟游诗人被动：每次造成伤害，概率给己方随机单位一个随机增益 */
export default defineSkill({
  id: 'bard-song',
  name: '战歌',
  kind: 'passive',
  cost: 5,
  weight: 0,
  desc: `每次造成伤害，${Math.round(CHANCE * 100)}% 概率奏响战歌，为一名随机友方附上随机增益。`,
  passive: {
    onDealtDamage(ctx, self) {
      if (!self.alive) return;
      const ally = pickAlly(ctx, self);
      if (!ally) return;
      applyRandomStatusFromPool(ctx, self, ally, RANDOM_BUFF_POOL, 0.15, CHANCE);
    },
  },
});
