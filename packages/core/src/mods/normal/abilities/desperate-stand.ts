import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

/** 幸运 ≤20 补偿层：运势差就拼命 */
export default defineAbility({
  id: 'desperate-stand',
  name: '背水一战',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·幸运≤20】生命低于 50% 时，造成的伤害 +30%。',
  tags: ['attack'],
  hooks: {
    modifyDamageCalc: (ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload => {
      if (p.attacker !== unit) return p;
      if (unit.stats['hp']! > unit.stats['maxHp']! * 0.5) return p;
      return { ...p, amount: p.amount * 1.3 };
    },
  },
});
