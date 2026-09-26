import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';
import { damageUnit } from '../rules/effects';

export default defineAbility({
  id: 'thorns',
  name: '荆棘',
  kind: 'passive',
  cost: 3,
  weight: 1,
  stackable: false,
  desc: '受到物理伤害时，将 15% 伤害反弹给攻击者。',
  tags: ['buff'],
  hooks: {
    onTakeDamage: (ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): void => {
      if (p.kind !== 'phys' || !unit.alive || !p.attacker.alive || p.amount <= 0) return;
      damageUnit(ctx, p.attacker, p.amount * 0.15, { source: '荆棘反伤', attackerUid: unit.uid });
    },
  },
});
