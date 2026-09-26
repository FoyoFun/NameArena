import { defineAbility } from './define';
import type { SkillCostPlan } from '../types';
import type { BattleContext, UnitRuntime } from '../../../engine';

export default defineAbility({
  id: 'hp-overcharge',
  name: '血气激涌',
  kind: 'passive',
  cost: 7,
  weight: 0.7,
  stackable: false,
  desc: '主动能力不再消耗法力，改为消耗 1.2 倍的生命。燃烧血脉！',
  tags: ['buff'],
  hooks: {
    modifySkillCost: (_ctx: BattleContext, _unit: UnitRuntime, plan: SkillCostPlan): SkillCostPlan => {
      if (plan.mp <= 0) return plan;
      return { mp: 0, hp: Math.round(plan.mp * 1.2) };
    },
  },
});
