import { defineSkill } from './define';

/** 猎犬的攻击技能（召唤物固有，不入池） */
export default defineSkill({
  id: 'hound-bite',
  name: '撕咬',
  kind: 'active',
  label: 'phys',
  cost: 0,
  weight: 0,
  desc: '撕咬敌人，造成 1.0 倍伤害。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [{ type: 'damage', scale: 1.0 }],
  },
});
