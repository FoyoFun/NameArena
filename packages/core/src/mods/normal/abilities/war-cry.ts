import { defineAbility } from './define';

export default defineAbility({
  id: 'war-cry',
  name: '战吼',
  kind: 'active',
  cost: 3,
  weight: 1,
  stackable: false,
  desc: '激励自己，攻击上升 30%，持续 3 回合。',
  tags: ['buff'],
  active: {
    mpCost: 10,
    cooldown: 3,
    target: 'self',
    effects: [{ type: 'status', status: 'atkUp', to: 'self', duration: 3, chance: 1 }],
  },
  vfx: 'buff',
});
