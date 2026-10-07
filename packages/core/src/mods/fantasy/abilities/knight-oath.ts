import { defineSkill } from './define';
import { favor } from '../rules/combat';

const CHANCE = 0.25;

/** 骑士被动：每次伤害判定前概率使伤害为 1（DESIGN-FANTASY.md §3.3） */
export default defineSkill({
  id: 'knight-oath',
  name: '铁壁誓约',
  kind: 'passive',
  label: 'common',
  cost: 7,
  weight: 0,
  desc: `每次受到伤害判定前，${Math.round(CHANCE * 100)}% 概率使这次伤害变为 1 点。`,
  vfx: 'guard',
  passive: {
    modifyIncomingDamage(ctx, self, amount) {
      if (ctx.rng.chance(favor(ctx, self, CHANCE))) {
        ctx.emit('log', { uid: self.uid, type: 'oath' }, [
          { target: `unit:${self.uid}`, durationMs: 400, logText: `🛡️ @${self.uid}@ 的#铁壁誓约#把伤害挡成了 1 点！` },
        ]);
        return 1;
      }
      return amount;
    },
  },
});
