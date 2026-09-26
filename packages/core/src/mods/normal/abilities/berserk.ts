import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

export default defineAbility({
  id: 'berserk',
  name: '狂暴',
  kind: 'passive',
  cost: 3,
  weight: 1,
  stackable: false,
  desc: '输出 +15%，但承受的伤害也 +10%。疼痛让头脑更清醒。',
  tags: ['attack'],
  hooks: {
    modifyDamageCalc: (_ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload => {
      if (p.attacker === unit) return { ...p, amount: p.amount * 1.15 };
      if (p.defender === unit) return { ...p, amount: p.amount * 1.1 };
      return p;
    },
  },
});
