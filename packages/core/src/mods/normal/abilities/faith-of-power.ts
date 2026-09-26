import { defineAbility } from './define';

export default defineAbility({
  id: 'faith-of-power',
  name: '力量信仰',
  kind: 'passive',
  cost: 2,
  weight: 1,
  stackable: false,
  desc: '坚信力量即正义，物理攻击 +12%。',
  tags: ['buff'],
  passiveStatMods: { atk: 1.12 },
});
