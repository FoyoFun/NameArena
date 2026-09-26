import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

/** 图案规则·中庸之道：≥4 项属性落在 45~55（主人点名的能力） */
export default defineAbility({
  id: 'zhongyong',
  name: '四两拨千斤',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【中庸之道】各项属性平平无奇，但深谙借力打力：受到的伤害 −15%，闪避 +50%。中庸，亦是大道。',
  tags: ['buff'],
  passiveStatMods: { dodge: 1.5 },
  hooks: {
    modifyDamageCalc: (_ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload => {
      if (p.defender !== unit) return p;
      return { ...p, amount: p.amount * 0.85 };
    },
  },
});
