import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

/** 体力 ≥91 超凡层 */
export default defineAbility({
  id: 'iron-wall',
  name: '铜墙铁壁',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·体力≥91】血肉之躯硬过城墙，受到的物理伤害 −20%。',
  tags: ['buff'],
  hooks: {
    modifyDamageCalc: (_ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload => {
      if (p.defender !== unit || p.kind !== 'phys') return p;
      return { ...p, amount: p.amount * 0.8 };
    },
  },
});
