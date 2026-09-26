import { defineAbility } from './define';

export default defineAbility({
  id: 'frost-arrow',
  name: '冰霜箭',
  kind: 'active',
  cost: 3,
  weight: 1,
  stackable: false,
  desc: '造成 120% 魔法伤害，70% 概率使目标迟缓。',
  tags: ['attack', 'control'],
  active: {
    mpCost: 12,
    cooldown: 0,
    target: 'enemy',
    effects: [
      { type: 'damage', kind: 'magic', scale: 1.2 },
      { type: 'status', status: 'spdDown', to: 'target', duration: 2, chance: 0.7 },
    ],
  },
  vfx: 'frost',
});
