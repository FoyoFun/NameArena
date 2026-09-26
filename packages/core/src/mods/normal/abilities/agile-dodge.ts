import { defineAbility } from './define';

/** 力量 ≤20 补偿层：打不动就闪开（主人的原始设计示例） */
export default defineAbility({
  id: 'agile-dodge',
  name: '灵动',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·力量≤20】举不动剑就学会躲，闪避 +80%，速度 +8%。',
  tags: ['buff'],
  passiveStatMods: { dodge: 1.8, spd: 1.08 },
});
