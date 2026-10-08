import { defineSkill } from './define';
import { fsOf } from '../rules/effects';
import { STATUS_MAP } from '../data/statuses';

/** 每层异常的增伤幅度与上限（F49 重做：刺客从"反仇恨索敌"改为按目标异常数增伤，单挑同样成立；
 *  F53 调参：0.15/0.75 时与 DoT 联动雪球过猛——1v1 变成"先挂上异常谁赢"，降为 0.10/0.60） */
const PER_AILMENT = 0.1;
const CAP = 0.6;

/** 目标身上的减益实例数（毒/流血/易伤/属性降……每实例一层，F50 引擎本就多实例并存） */
function debuffCount(target: { meta: Record<string, unknown> }): number {
  let n = 0;
  for (const inst of fsOf(target as never)) {
    if (STATUS_MAP.get(inst.id)?.kind === 'debuff') n += 1;
  }
  return n;
}

/** 刺客被动：弱点洞悉——目标身上每有一个异常状态，自己的伤害 +15%（上限 +75%） */
export default defineSkill({
  id: 'assassin-instinct',
  name: '弱点洞悉',
  kind: 'passive',
  cost: 6,
  weight: 0,
  desc: `看穿破绽：目标身上每有 1 个异常状态（每层独立计），对其伤害 +${Math.round(PER_AILMENT * 100)}%，最高 +${Math.round(CAP * 100)}%。`,
  passive: {
    modifyDamageOut(ctx, self, amount, defender) {
      const n = debuffCount(defender);
      if (n <= 0) return amount;
      return amount * (1 + Math.min(CAP, n * PER_AILMENT));
    },
  },
});
