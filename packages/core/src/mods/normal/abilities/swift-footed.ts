import { defineAbility } from './define';

export default defineAbility({
  id: 'swift-footed',
  name: '迅捷之足',
  kind: 'passive',
  cost: 2,
  weight: 1,
  stackable: false,
  desc: '脚下生风，速度 +10%，闪避 +30%。',
  tags: ['buff'],
  passiveStatMods: { spd: 1.1, dodge: 1.3 },
});
