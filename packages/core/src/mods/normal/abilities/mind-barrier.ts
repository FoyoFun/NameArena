import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

/** 精神 ≥91 超凡层 */
export default defineAbility({
  id: 'mind-barrier',
  name: '心灵屏障',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·精神≥91】精神壁垒坚不可摧，受到的魔法伤害 −20%。',
  tags: ['buff'],
  hooks: {
    modifyDamageCalc: (_ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload => {
      if (p.defender !== unit || p.kind !== 'magic') return p;
      return { ...p, amount: p.amount * 0.8 };
    },
  },
});
