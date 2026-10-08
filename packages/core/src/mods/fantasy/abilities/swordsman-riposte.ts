import { defineSkill } from './define';
import type { SkillDef } from '../types';
import { favor, attackOnce, clockOf } from '../rules/combat';
import { getSkill } from './index';
import { executeSkill } from '../rules/ai';

const CHANCE = 0.18;
const FALLBACK_SCALE = 0.6;

/** 自己技能里能"随手放出来"的攻击技能（目标=敌方的主动伤害技，含吟唱技——燕返秒放） */
function instantAttackSkills(self: { skills: { id: string }[] }): SkillDef[] {
  const out: SkillDef[] = [];
  for (const cs of self.skills) {
    const def = getSkill(cs.id);
    if (def?.kind === 'active' && def.active?.target === 'enemy' && def.active.effects.some((e) => e.type === 'damage')) {
      out.push(def);
    }
  }
  return out;
}

/**
 * 剑士被动（F49 重做，1v1 向）：受到伤害后概率立刻随机释放自己一个攻击技能反击——
 * 吟唱技能也直接秒放；一个攻击技都没有时退回 0.6 倍普通反击。
 * 反击中不再触发新的燕返（riposteDepth 防两边互反死循环）。
 */
export default defineSkill({
  id: 'swordsman-riposte',
  name: '燕返',
  kind: 'passive',
  label: 'phys',
  cost: 6,
  weight: 0,
  desc: `每次受到伤害后，${Math.round(CHANCE * 100)}% 概率立刻拔剑还击：随机释放自己掌握的一个攻击技能（吟唱技直接秒放；没有攻击技则普通反击 0.6 倍）。`,
  vfx: 'slash',
  passive: {
    onTakenDamage(ctx, self, p) {
      if (!self.alive || !p.attacker.alive) return;
      if (((ctx.state.scratch['riposteDepth'] as number | undefined) ?? 0) > 0) return;
      // 同一技能的同一次打击（多段 Hit）只 roll 一次燕返——多段技不该被按段数放大反击概率（F53 调参）
      const key = `${clockOf(ctx)}:${p.source ?? ''}`;
      if ((self.meta['lastRiposteKey'] as string | undefined) === key) return;
      if (!ctx.rng.chance(favor(ctx, self, CHANCE))) {
        self.meta['lastRiposteKey'] = key;
        return;
      }
      self.meta['lastRiposteKey'] = key;
      ctx.emit('log', { uid: self.uid, type: 'riposte' }, [
        { target: `unit:${self.uid}`, vfx: 'slash', durationMs: 450, logText: `⚔️ @${self.uid}@ 的#燕返#！` },
      ]);
      ctx.state.scratch['riposteDepth'] = 1;
      try {
        const list = instantAttackSkills(self.char as { skills: { id: string }[] });
        if (list.length > 0) {
          executeSkill(ctx, self, ctx.rng.pick(list), 0);
        } else {
          attackOnce(ctx, self, p.attacker, FALLBACK_SCALE, { source: '燕返', isCounter: true });
        }
      } finally {
        ctx.state.scratch['riposteDepth'] = 0;
      }
    },
  },
});
