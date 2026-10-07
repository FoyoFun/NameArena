import { defineSkill } from './define';
import { ailmentChance } from '../rules/combat';
import { applyStatusInstance } from '../rules/effects';

const CHANCE = 0.3;

/** 猎人被动：自己与自己的召唤单位造成伤害时，概率使目标获得 1 层易伤 */
export default defineSkill({
  id: 'hunter-mark',
  name: '猎印记',
  kind: 'passive',
  label: 'common',
  cost: 6,
  weight: 0,
  desc: `自己与自己的召唤单位造成伤害时，${Math.round(CHANCE * 100)}% 概率使目标获得 1 层#易伤#（每层受伤 +25%）。`,
  passive: {
    onDealtDamage(ctx, self, p) {
      if (!self.alive || !p.defender.alive) return;
      if (!ctx.rng.chance(ailmentChance(ctx, self, CHANCE, 0.8))) return;
      applyStatusInstance(ctx, p.defender, 'vulnerable', { sourceUid: self.uid });
    },
  },
});
