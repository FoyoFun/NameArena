import { defineAbility } from './define';

export default defineAbility({
  id: 'heal-wave',
  name: '治疗波',
  kind: 'active',
  cost: 3,
  weight: 1,
  stackable: false,
  desc: '治疗一名伤势最重的队友，恢复量受魔攻加成。',
  tags: ['heal'],
  active: {
    mpCost: 14,
    cooldown: 1,
    target: 'ally',
    effects: [{ type: 'heal', scale: 1.3 }],
  },
  vfx: 'heal',
});
