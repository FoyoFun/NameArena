import type { BattleContext, UnitRuntime } from '../../../engine';
import { getAbility } from '../abilities';
import { FORMULAS } from '../data/formulas';
import { PERSONALITIES, PERSONALITY_MAP } from '../data/personalities';
import { STATUS_MAP } from '../data/statuses';
import { calcDamage, hitChance, resolveTargets } from './combat';
import { applyModifySkillCost } from './hooks';
import { charOf, effStat } from './stats';
import type { AbilityDef } from '../types';
import type { Personality } from '../data/personalities';

/**
 * AI 打分制（DESIGN.md 7.8）。
 * 保底铁律：任何类别乘数 ≥0.7（性格钳制）、普攻永远可用兜底、除硬控外必须行动。
 */

export interface AIChoice {
  ability: AbilityDef;
  targets: UnitRuntime[];
}

function personalityOf(unit: UnitRuntime): Personality {
  return PERSONALITY_MAP.get(charOf(unit).personalityId) ?? PERSONALITIES[3]!;
}

function firstDamage(ability: AbilityDef) {
  return ability.active!.effects.find((e) => e.type === 'damage') as
    | { type: 'damage'; kind: 'phys' | 'magic'; scale: number }
    | undefined;
}

/** 估算能力价值（确定性：不消耗 rng，伤害不计随机浮动与暴击） */
function estimateAbility(ctx: BattleContext, unit: UnitRuntime, ability: AbilityDef, targets: UnitRuntime[]): number {
  const act = ability.active!;
  let value = 0;
  for (const effect of act.effects) {
    if (effect.type === 'damage') {
      for (const t of targets) {
        const expected = calcDamage(ctx, unit, t, effect.kind, effect.scale, false, false);
        value += expected * hitChance(unit, t);
      }
    } else if (effect.type === 'heal') {
      const t = targets[0];
      if (!t) continue;
      const ratio = t.stats['hp']! / t.stats['maxHp']!;
      value += effStat(unit, 'mag') * effect.scale * Math.max(0.15, 1 - ratio) * 2;
    } else if (effect.type === 'status') {
      const def = STATUS_MAP.get(effect.status);
      if (!def) continue;
      let base = 25;
      if (def.control === 'stun') base = 45;
      else if (def.dot === 'damage') base = 30;
      else if (def.kind === 'buff') base = act.target === 'self' ? (ctx.state.round <= 2 ? 35 : 12) : 20;
      value += base * effect.chance;
    }
  }
  return value;
}

/** 为当前行动槽选择行动。
 *  节目效果（DESIGN.md #43）：不永远选最优解——分数前 K 名按分数轮盘赌，
 *  AI 会"灵光一闪"；斩杀的 +10000 大分在轮盘里权重碾压，依然必补刀。
 *  保底铁律不变：普攻永远可用兜底，除硬控外必须行动。 */
export function chooseAction(ctx: BattleContext, unit: UnitRuntime): AIChoice {
  const P = personalityOf(unit);
  const actives = charOf(unit)
    .abilities.map((ca) => getAbility(ca.id))
    .filter((a): a is AbilityDef => !!a && a.kind === 'active');

  const options: Array<AIChoice & { score: number }> = [];
  const cd = unit.meta['cd'] as Record<string, number>;

  for (const ability of actives) {
    const act = ability.active!;
    if ((cd[ability.id] ?? 0) > 0) continue;
    const plan = applyModifySkillCost(ctx, unit, { mp: act.mpCost, hp: 0 });
    if (plan.mp > unit.stats['mp']!) continue;
    if (plan.hp > 0 && unit.stats['hp']! <= plan.hp) continue; // 不允许被自己的能力扣死
    const targets = resolveTargets(ctx, unit, act.target);
    if (targets.length === 0) continue;

    const mainTag = ability.tags[0] ?? 'attack';
    const mult =
      mainTag === 'heal' ? P.mult.heal : mainTag === 'buff' ? P.mult.buff : mainTag === 'control' ? P.mult.control : P.mult.attack;
    const noise = 1 + (ctx.rng.next() - 0.5) * 2 * P.noise;
    let score = estimateAbility(ctx, unit, ability, targets) * mult * noise;

    // 斩杀检测：权重碾压（性格再怂也补刀——补刀不属于"倾向"而属于胜利）
    const dmg = firstDamage(ability);
    if (dmg) {
      for (const t of targets) {
        const est = calcDamage(ctx, unit, t, dmg.kind, dmg.scale, false, false);
        if (est >= t.stats['hp']!) {
          score += 10_000;
          break;
        }
      }
    }
    options.push({ ability, targets, score });
  }

  if (options.length === 0) {
    const basic = getAbility('basic-attack')!;
    return { ability: basic, targets: resolveTargets(ctx, unit, 'enemy') };
  }
  options.sort((a, b) => b.score - a.score);
  const top = options.slice(0, FORMULAS.aiTopK);
  return ctx.rng.weighted(top.map((o) => ({ item: o, weight: Math.max(1, o.score) })));
}
