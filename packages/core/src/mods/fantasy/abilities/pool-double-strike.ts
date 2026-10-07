import { defineSkill } from './define';
import { favor } from '../rules/combat';

const CHANCE = 0.35;

/** 池被动：概率一回合行动 2 次（追加行动 +0.8×权重） */
export default defineSkill({
  id: 'pool-double-strike',
  name: '二连击',
  kind: 'passive',
  cost: 8,
  weight: 1,
  desc: `每个回合 ${Math.round(CHANCE * 100)}% 概率追加一次行动。`,
  passive: {
    extraActions(ctx, self) {
      return ctx.rng.chance(favor(ctx, self, CHANCE)) ? 1 : 0;
    },
  },
});
