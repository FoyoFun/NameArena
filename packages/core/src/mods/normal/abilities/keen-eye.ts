import { defineAbility } from './define';

export default defineAbility({
  id: 'keen-eye',
  name: '锐利目光',
  kind: 'passive',
  cost: 2,
  weight: 1,
  stackable: false,
  desc: '一眼看穿破绽，暴击率 +40%，暴击伤害 +15%。',
  tags: ['buff'],
  passiveStatMods: { crit: 1.4, critDmg: 1.15 },
});
