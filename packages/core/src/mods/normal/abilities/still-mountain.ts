import { defineAbility } from './define';

/** 敏捷 ≤20 补偿层：跑不快就站得稳 */
export default defineAbility({
  id: 'still-mountain',
  name: '不动如山',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·敏捷≤20】以静制动，物理防御 +20%，魔法防御 +10%。',
  tags: ['buff'],
  passiveStatMods: { pdef: 1.2, mdef: 1.1 },
});
