import { defineAbility } from './define';

export default defineAbility({
  id: 'fireball',
  name: '火球术',
  kind: 'active',
  cost: 3,
  weight: 1,
  stackable: false,
  desc: '掷出火球，造成 140% 魔法伤害，60% 概率附加灼烧。',
  tags: ['attack'],
  active: {
    mpCost: 15,
    cooldown: 0,
    target: 'enemy',
    effects: [
      { type: 'damage', kind: 'magic', scale: 1.4 },
      { type: 'status', status: 'burn', to: 'target', duration: 2, chance: 0.6, powerScale: 0.18 },
    ],
  },
  vfx: 'fireball',
});
