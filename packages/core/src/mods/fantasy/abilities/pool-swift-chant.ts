import { defineSkill } from './define';
import { favor } from '../rules/combat';

const CHANCE = 0.4;

/** 池被动：概率不需要吟唱（瞬发） */
export default defineSkill({
  id: 'pool-swift-chant',
  name: '迅咏',
  kind: 'passive',
  cost: 7,
  weight: 1,
  desc: `发起吟唱时，${Math.round(CHANCE * 100)}% 概率免除吟唱、立即发动。`,
  passive: {
    skipCast(ctx, self) {
      return ctx.rng.chance(favor(ctx, self, CHANCE));
    },
  },
});
