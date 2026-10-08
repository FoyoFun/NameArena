import { defineSkill } from './define';
import { effStat, favor } from '../rules/combat';
import { healUnit } from '../rules/effects';

const CHANCE = 0.18;
const SCALE = 0.22;

/** 白魔导师被动：造成伤害时概率恢复生命百分比最低的队友 */
export default defineSkill({
  id: 'whitemage-grace',
  name: '圣光之惠',
  kind: 'passive',
  cost: 6,
  weight: 0,
  desc: `造成伤害时，${Math.round(CHANCE * 100)}% 概率治疗一名生命百分比最低的队友（${Math.round(SCALE * 100)}% 攻击）。`,
  passive: {
    onDealtDamage(ctx, self) {
      if (!self.alive) return;
      if (!ctx.rng.chance(favor(ctx, self, CHANCE))) return;
      const allies = ctx.state.units.filter((u) => u.alive && u.side === self.side);
      if (allies.length === 0) return;
      const lowest = allies.reduce((a, b) => (b.stats['hp']! / b.stats['maxHp']! < a.stats['hp']! / a.stats['maxHp']! ? b : a));
      healUnit(ctx, lowest, effStat(self, 'atk') * SCALE, '圣光之惠');
    },
  },
});
