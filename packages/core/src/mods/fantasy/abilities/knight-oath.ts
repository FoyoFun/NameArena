import { defineSkill } from './define';
import { favor } from '../rules/combat';

const CHANCE = 0.09;
/** 天选影响缩放（F49 群友反馈：原触发率太高，且要降低天选对该被动的影响） */
const PT_SCALE = 0.5;

/** 骑士被动：每次伤害判定前概率使伤害为 1 */
export default defineSkill({
  id: 'knight-oath',
  name: '铁壁誓约',
  kind: 'passive',
  label: 'common',
  cost: 7,
  weight: 0,
  desc: `每次受到伤害判定前，${Math.round(CHANCE * 100)}% 概率使这次伤害变为 1 点（受天选加成，但影响减半）。`,
  vfx: 'guard',
  passive: {
    modifyIncomingDamage(ctx, self, amount, attacker) {
      if (ctx.rng.chance(favor(ctx, self, CHANCE, 0, 1, PT_SCALE))) {
        ctx.emit('log', { uid: self.uid, type: 'oath' }, [
          { target: `unit:${self.uid}`, durationMs: 400, logText: `🛡️ @${self.uid}@ 的#铁壁誓约#把 @${attacker.uid}@ 的伤害挡成了 1 点！` },
        ]);
        return 1;
      }
      return amount;
    },
  },
});
