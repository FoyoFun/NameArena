import { defineAbility } from './define';

/** 敏捷 ≥91 超凡层 */
export default defineAbility({
  id: 'godspeed',
  name: '神速',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【条件·敏捷≥91】快过残影，速度 +25%，闪避 +50%。',
  tags: ['buff'],
  passiveStatMods: { spd: 1.25, dodge: 1.5 },
});
