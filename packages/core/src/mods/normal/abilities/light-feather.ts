import { defineAbility } from './define';

/** 体力 ≤20 补偿层：脆皮就别挨打 */
export default defineAbility({
  id: 'light-feather',
  name: '轻若鸿毛',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·体力≤20】身体轻盈，闪避 +100%。',
  tags: ['buff'],
  passiveStatMods: { dodge: 2.0 },
});
