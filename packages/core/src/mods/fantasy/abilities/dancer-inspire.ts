import { defineSkill } from './define';
import { RANDOM_BUFF_POOL } from '../data/statuses';

/** 舞娘主动：给己方随机单位增益（目标与增益完全随机，主人裁定） */
export default defineSkill({
  id: 'dancer-inspire',
  name: '鼓舞',
  kind: 'active',
  cost: 4,
  weight: 0,
  desc: '以舞姿鼓舞一名随机友方，附上随机增益（攻击/防御/速度提升或回春）。',
  vfx: 'buff',
  active: {
    target: 'ally',
    effects: [{ type: 'status', status: RANDOM_BUFF_POOL[0]!, pool: RANDOM_BUFF_POOL, chance: 1, powerScaleAtk: 0.15 }],
  },
});
