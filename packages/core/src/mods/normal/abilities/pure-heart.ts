import { defineAbility } from './define';

/** 精神 ≤20 补偿层 */
export default defineAbility({
  id: 'pure-heart',
  name: '淳朴之心',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·精神≤20】心思单纯，法力上限 +30%。',
  tags: ['buff'],
  passiveStatMods: { maxMp: 1.3 },
});
