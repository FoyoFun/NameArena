import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

/** 力量 ≥91 超凡层 */
export default defineAbility({
  id: 'brute-force',
  name: '怪力',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·力量≥91】肌肉即真理，物理伤害 +25%。',
  tags: ['attack'],
  hooks: {
    modifyDamageCalc: (_ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload => {
      if (p.attacker !== unit || p.kind !== 'phys') return p;
      return { ...p, amount: p.amount * 1.25 };
    },
  },
});
