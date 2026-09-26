import { defineAbility } from './define';

export default defineAbility({
  id: 'heavy-slash',
  name: '重斩',
  kind: 'active',
  cost: 3,
  weight: 1,
  stackable: false,
  desc: '倾尽全力的一击，造成 160% 物理伤害。',
  tags: ['attack'],
  active: {
    mpCost: 12,
    cooldown: 1,
    target: 'enemy',
    effects: [{ type: 'damage', kind: 'phys', scale: 1.6 }],
  },
  vfx: 'slash',
});
