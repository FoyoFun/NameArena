import { defineAbility } from './define';

export default defineAbility({
  id: 'poison-blade',
  name: '毒刃',
  kind: 'active',
  cost: 3,
  weight: 1,
  stackable: false,
  desc: '淬毒的斩击，90% 物理伤害，70% 概率使目标中毒。',
  tags: ['attack'],
  active: {
    mpCost: 10,
    cooldown: 0,
    target: 'enemy',
    effects: [
      { type: 'damage', kind: 'phys', scale: 0.9 },
      { type: 'status', status: 'poison', to: 'target', duration: 3, chance: 0.7, powerScale: 0.12 },
    ],
  },
  vfx: 'poison',
});
