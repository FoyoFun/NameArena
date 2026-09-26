import { defineAbility } from './define';

export default defineAbility({
  id: 'rock-solid',
  name: '坚如磐石',
  kind: 'passive',
  cost: 2,
  weight: 1,
  stackable: false,
  desc: '心如磐石，身如磐石，最大生命 +12%。',
  tags: ['buff'],
  passiveStatMods: { maxHp: 1.12 },
});
