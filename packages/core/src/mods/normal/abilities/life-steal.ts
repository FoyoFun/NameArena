import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';
import { healUnit } from '../rules/effects';

export default defineAbility({
  id: 'life-steal',
  name: '嗜血',
  kind: 'passive',
  cost: 4,
  weight: 1,
  stackable: false,
  desc: '物理伤害的 20% 转化为自身生命。',
  tags: ['attack'],
  hooks: {
    onDealDamage: (ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): void => {
      if (p.kind !== 'phys' || !unit.alive || p.amount <= 0) return;
      healUnit(ctx, unit, p.amount * 0.2, '嗜血');
    },
  },
});
