import { defineAbility } from './define';

export default defineAbility({
  id: 'double-action',
  name: '二连击·改',
  kind: 'passive',
  cost: 8,
  weight: 0.7,
  stackable: false,
  desc: '行动速度超越常理，每回合可以额外行动 1 次。',
  tags: ['buff'],
  hooks: {
    modifyActionCount: () => 1,
  },
});
