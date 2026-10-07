import { defineSkill } from './define';

/** 格斗家主动：追击模型（Q2 方案A）——每段后 70% 概率追击下一段，最多 10 段，每段 0.35 倍 */
export default defineSkill({
  id: 'grappler-barrage',
  name: '爆裂连拳',
  kind: 'active',
  label: 'phys',
  cost: 6,
  weight: 0,
  desc: '打出连绵拳雨：每段 0.35 倍伤害，每段后 70% 概率继续，最多 10 段。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [{ type: 'damage', scale: 0.35, chase: { p: 0.7, max: 10 } }],
  },
});
