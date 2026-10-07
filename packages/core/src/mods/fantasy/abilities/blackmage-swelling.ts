import { defineSkill } from './define';
import { clockOf } from '../rules/combat';

const PER_TICK = 0.01;
const CAP = 0.8;

/** 黑魔导师被动：距上次主动造成伤害越久，本次伤害越高（每 tick +1%，上限 +80%） */
export default defineSkill({
  id: 'blackmage-swelling',
  name: '魔力积蓄',
  kind: 'passive',
  cost: 6,
  weight: 0,
  desc: '距离上次造成伤害越久，魔力积蓄越多：每过 1 时钟 +1% 伤害，最高 +80%。',
  passive: {
    modifyDamageOut(ctx, self, amount) {
      const last = (self.meta['lastHarmTick'] as number | undefined) ?? 0;
      const bonus = Math.min(CAP, Math.max(0, clockOf(ctx) - last) * PER_TICK);
      return amount * (1 + bonus);
    },
  },
});
