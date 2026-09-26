import { defineAbility } from './define';

/** 智慧 ≤20 补偿层：不会念咒就练直觉 */
export default defineAbility({
  id: 'wild-instinct',
  name: '野性直觉',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·智慧≤20】不靠脑子靠本能，暴击率 +50%，暴击伤害 +15%。',
  tags: ['buff'],
  passiveStatMods: { crit: 1.5, critDmg: 1.15 },
});
