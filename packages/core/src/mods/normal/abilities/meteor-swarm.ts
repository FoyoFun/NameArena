import { defineAbility } from './define';

export default defineAbility({
  id: 'meteor-swarm',
  name: '流星雨',
  kind: 'active',
  cost: 4,
  weight: 1,
  stackable: false,
  desc: '呼唤流星，对所有敌人造成 80% 魔法伤害。',
  tags: ['attack'],
  active: {
    mpCost: 22,
    cooldown: 2,
    target: 'allEnemies',
    effects: [{ type: 'damage', kind: 'magic', scale: 0.8 }],
  },
  vfx: 'meteor',
});
