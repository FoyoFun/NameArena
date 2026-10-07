import { defineSkill } from './define';
import { favor } from '../rules/combat';
import { applyRandomStatusFromPool } from '../rules/ai';
import { RANDOM_BUFF_POOL } from '../data/statuses';

const CHANCE = 0.4;
const MAX_CHAIN = 2;

/** 舞娘被动：当给单位增益时，概率再上一个随机增益（链上限防无限） */
export default defineSkill({
  id: 'dancer-steps',
  name: '双重舞步',
  kind: 'passive',
  cost: 5,
  weight: 0,
  desc: `每次施加增益时，${Math.round(CHANCE * 100)}% 概率翩然再舞，追加一个随机增益。`,
  passive: {
    onBuffApplied(ctx, self, target) {
      if (!self.alive || !target?.alive) return;
      const depth = (self.meta['buffChain'] as number | undefined) ?? 0;
      if (depth >= MAX_CHAIN) return;
      if (!ctx.rng.chance(favor(ctx, self, CHANCE))) return;
      self.meta['buffChain'] = depth + 1;
      try {
        applyRandomStatusFromPool(ctx, self, target, RANDOM_BUFF_POOL, 0.15);
      } finally {
        self.meta['buffChain'] = depth;
      }
    },
  },
});
