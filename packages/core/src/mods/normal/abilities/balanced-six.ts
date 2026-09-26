import { defineAbility } from './define';

/** 图案规则·六均衡：六维极差 ≤3 */
export default defineAbility({
  id: 'balanced-six',
  name: '均衡之相',
  kind: 'passive',
  cost: 0,
  weight: 0,
  stackable: false,
  desc: '【六均衡】六维浑然一体：生命 +15%，暴击率 +50%，闪避 +30%。',
  tags: ['buff'],
  passiveStatMods: { maxHp: 1.15, crit: 1.5, dodge: 1.3 },
});
