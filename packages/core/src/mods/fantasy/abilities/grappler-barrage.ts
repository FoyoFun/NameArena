import { defineSkill } from './define';

/**
 * 格斗家主动（F49 重做）：最多 4 段、每段后 60% 概率追击（期望 ≈2.2 段）。
 * 每段 Hit 独立结算命中/暴击/骑士铁壁等（多段 Hit 铁律），追击概率受天选影响减半。
 */
export default defineSkill({
  id: 'grappler-barrage',
  name: '爆裂连拳',
  kind: 'active',
  label: 'phys',
  cost: 6,
  weight: 0,
  desc: '打出连绵拳雨：每段 0.45 倍伤害，每段独立判定命中与暴击，每段后 60% 概率继续，最多 4 段（期望 ≈2.2 段）。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [{ type: 'damage', scale: 0.45, chase: { p: 0.6, max: 4, ptScale: 0.5 } }],
  },
});
