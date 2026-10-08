import { defineSkill } from './define';
import { RANDOM_BUFF_POOL } from '../data/statuses';

/** 舞娘主动（F49 重做，1v1 向）：伤害为主，概率给自己一个随机增益 */
export default defineSkill({
  id: 'dancer-inspire',
  name: '鼓舞',
  kind: 'active',
  cost: 4,
  weight: 0,
  desc: '舞中有杀机：造成 1.0 倍伤害，并有 35% 概率为自己附上一个随机增益（攻击/防御/速度提升或回春）。',
  vfx: 'slash',
  active: {
    target: 'enemy',
    effects: [
      { type: 'damage', scale: 1.0 },
      { type: 'status', status: RANDOM_BUFF_POOL[0]!, pool: RANDOM_BUFF_POOL, chance: 0.35, to: 'self', powerScaleAtk: 0.15 },
    ],
  },
});
