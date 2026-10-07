import { defineSkill } from './define';
import { favor, attackOnce } from '../rules/combat';

const CHANCE = 0.3;

/** 剑士被动：每次受到伤害，概率对伤害来源反击（反反击由 isCounter 阻断，防无限互反） */
export default defineSkill({
  id: 'swordsman-riposte',
  name: '燕返',
  kind: 'passive',
  label: 'phys',
  cost: 6,
  weight: 0,
  desc: `每次受到伤害后，${Math.round(CHANCE * 100)}% 概率立刻反击伤害来源（0.6 倍伤害）。`,
  vfx: 'slash',
  passive: {
    onTakenDamage(ctx, self, p) {
      if (!self.alive || !p.attacker.alive) return;
      if (!ctx.rng.chance(favor(ctx, self, CHANCE))) return;
      ctx.emit('log', { uid: self.uid, type: 'riposte' }, [
        { target: `unit:${self.uid}`, vfx: 'slash', durationMs: 450, logText: `⚔️ @${self.uid}@ 的#燕返#！` },
      ]);
      attackOnce(ctx, self, p.attacker, 0.6, { source: '燕返', isCounter: true });
    },
  },
});
