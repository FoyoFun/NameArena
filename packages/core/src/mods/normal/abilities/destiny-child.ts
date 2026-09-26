import { defineAbility } from './define';

/** 幸运 ≥91 超凡层 */
export default defineAbility({
  id: 'destiny-child',
  name: '天命之人',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·幸运≥91】命运偏爱，暴击率 +50%，暴击伤害 +20%。',
  tags: ['buff'],
  passiveStatMods: { crit: 1.5, critDmg: 1.2 },
});
