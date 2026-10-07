import { defineSkill } from './define';
import { favor } from '../rules/combat';
import { healUnit } from '../rules/effects';

const CHANCE = 0.3;
const RATIO = 0.4;

/** 战士被动：造成伤害后概率将伤害转换为生命 */
export default defineSkill({
  id: 'warrior-bloodthirst',
  name: '嗜血',
  kind: 'passive',
  cost: 6,
  weight: 0,
  desc: `每次造成伤害后，${Math.round(CHANCE * 100)}% 概率将伤害的 ${Math.round(RATIO * 100)}% 转换为生命。`,
  passive: {
    onDealtDamage(ctx, self, p) {
      if (!self.alive) return;
      if (ctx.rng.chance(favor(ctx, self, CHANCE))) {
        healUnit(ctx, self, p.amount * RATIO, '嗜血');
      }
    },
  },
});
