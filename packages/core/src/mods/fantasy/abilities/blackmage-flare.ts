import { defineSkill } from './define';

/** 黑魔导师主动：吟唱伤害技。吟唱时长 = 500 + roll(0~500)；伤害随实际吟唱耗时增强（F6：速度是双刃剑） */
export default defineSkill({
  id: 'blackmage-flare',
  name: '究极炎爆',
  kind: 'active',
  label: 'magic',
  cost: 5,
  weight: 0,
  desc: '咏唱后引爆究极火焰：吟唱 400+随机 400；伤害 0.9 倍起，实际吟唱越久伤害越高（最多 +1.2 倍）；18% 概率灼烧或冰冻。',
  vfx: 'fireball',
  active: {
    target: 'enemy',
    cast: { base: 400, rollMax: 400 },
    castDivisor: 600,
    castScale: 1.2,
    effects: [
      { type: 'damage', scale: 0.9 },
      { type: 'status', status: 'burn', pool: ['burn', 'freeze'], chance: 0.18, ailmentScale: 0.7, powerScaleAtk: 0.15 },
    ],
  },
});
