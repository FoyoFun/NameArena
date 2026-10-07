import { defineSkill } from './define';
import { applyRandomStatusFromPool } from '../rules/ai';
import { RANDOM_BUFF_POOL, RANDOM_DEBUFF_POOL } from '../data/statuses';

/** 药师被动：造成伤害时概率上负面效果；造成治疗时概率上正面效果 */
export default defineSkill({
  id: 'apothecary-pharmacy',
  name: '药理',
  kind: 'passive',
  cost: 6,
  weight: 0,
  desc: `造成伤害时 30% 概率附加随机负面状态（受异常率影响）；治疗时 30% 概率附加随机增益。`,
  passive: {
    onDealtDamage(ctx, self, p) {
      if (!self.alive || !p.defender.alive) return;
      applyRandomStatusFromPool(ctx, self, p.defender, RANDOM_DEBUFF_POOL, 0.1, 0.3, 0.8);
    },
    onHealDone(ctx, self, target) {
      if (!self.alive || !target.alive) return;
      applyRandomStatusFromPool(ctx, self, target, RANDOM_BUFF_POOL, 0.15, 0.3);
    },
  },
});
