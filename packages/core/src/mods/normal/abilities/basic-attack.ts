import { defineAbility } from './define';

/** 普攻：人人免费自带，永不入抽取池，保证任何角色任何时候都有输出能力。 */
export default defineAbility({
  id: 'basic-attack',
  name: '普攻',
  kind: 'active',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '稳定的物理攻击，不消耗法力，永远可用。',
  tags: ['attack'],
  active: {
    mpCost: 0,
    cooldown: 0,
    target: 'enemy',
    effects: [{ type: 'damage', kind: 'phys', scale: 1.0 }],
  },
  vfx: 'slash',
});
