import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

/** 智慧 ≥91 超凡层 */
export default defineAbility({
  id: 'arcane-master',
  name: '奥术大师',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·智慧≥91】魔力深不见底，魔法伤害 +25%。',
  tags: ['attack'],
  hooks: {
    modifyDamageCalc: (_ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload => {
      if (p.attacker !== unit || p.kind !== 'magic') return p;
      return { ...p, amount: p.amount * 1.25 };
    },
  },
});
