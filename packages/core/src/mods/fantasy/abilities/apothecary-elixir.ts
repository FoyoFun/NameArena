import { defineSkill } from './define';

/**
 * 药师主动（F49 重做，替代原"灵药"）：掷出不稳定试管——伤害必定发生；
 * 中毒与自疗各自独立 roll 概率，不互斥，可能同时发生（也可能都不发生）。
 */
export default defineSkill({
  id: 'apothecary-elixir',
  name: '危险实验',
  kind: 'active',
  label: 'phys',
  cost: 4,
  weight: 0,
  desc: '把冒泡的试管砸向敌人：造成 1.0 倍伤害；40% 概率使目标中毒，35% 概率恢复自己 0.5 倍攻击的生命——两个概率独立结算，可能同时发生。',
  vfx: 'poison',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.0 },
      { type: 'status', status: 'poison', chance: 0.4, ailmentScale: 0.9, powerScaleAtk: 0.12 },
      { type: 'heal', scale: 0.5, chance: 0.35, to: 'self' },
    ],
  },
});
