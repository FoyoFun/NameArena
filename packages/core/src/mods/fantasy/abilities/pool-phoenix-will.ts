import { defineSkill } from './define';

const CHANCE = 0.15;

/** 池被动：死亡后概率 1 滴血复活（无次数上限，受天选加成） */
export default defineSkill({
  id: 'pool-phoenix-will',
  name: '不死鸟之志',
  kind: 'passive',
  cost: 8,
  weight: 1,
  desc: `倒下后，每次轮到自己的行动时刻有 ${Math.round(CHANCE * 100)}% 概率以 1 点生命复活。`,
  passive: {
    reviveChance() {
      return CHANCE;
    },
  },
});
