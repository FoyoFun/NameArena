import { defineSkill } from './define';
import { RANDOM_BUFF_POOL } from '../data/statuses';

/** 池技能：给随机友方上随机增益 */
export default defineSkill({
  id: 'pool-blessing',
  name: '祝福',
  kind: 'active',
  cost: 4,
  weight: 1,
  desc: '为一名随机友方降下祝福：随机获得攻击/防御/速度提升或回春。',
  vfx: 'buff',
  active: {
    target: 'ally',
    effects: [{ type: 'status', status: RANDOM_BUFF_POOL[0]!, pool: RANDOM_BUFF_POOL, chance: 1, powerScaleAtk: 0.15 }],
  },
});
