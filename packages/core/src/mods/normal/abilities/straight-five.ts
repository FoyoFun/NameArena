import { defineAbility } from './define';
import type { DamagePayload } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

/** 图案规则·顺子：5 项属性构成公差 1 的等差（天文彩票级头奖） */
export default defineAbility({
  id: 'straight-five',
  name: '天选连环',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【顺子】五维连成一线，命运之环加身：造成伤害 +15%，受到伤害 −15%。你抽到这个名字的概率比被雷劈还低。',
  tags: ['buff'],
  hooks: {
    modifyDamageCalc: (_ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload => {
      if (p.attacker === unit) return { ...p, amount: p.amount * 1.15 };
      if (p.defender === unit) return { ...p, amount: p.amount * 0.85 };
      return p;
    },
  },
});
