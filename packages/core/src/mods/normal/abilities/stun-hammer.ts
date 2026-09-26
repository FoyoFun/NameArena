import { defineAbility } from './define';

export default defineAbility({
  id: 'stun-hammer',
  name: '眩晕锤',
  kind: 'active',
  cost: 4,
  weight: 1,
  stackable: false,
  desc: '造成 100% 物理伤害，35% 概率眩晕目标一回合。',
  tags: ['attack', 'control'],
  active: {
    mpCost: 16,
    cooldown: 2,
    target: 'enemy',
    effects: [
      { type: 'damage', kind: 'phys', scale: 1.0 },
      { type: 'status', status: 'stun', to: 'target', duration: 1, chance: 0.35 },
    ],
  },
  vfx: 'stun',
});
