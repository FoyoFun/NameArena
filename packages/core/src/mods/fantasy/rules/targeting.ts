import type { BattleContext, UnitRuntime } from '../../../engine';
import { FORMULAS } from '../data/formulas';
import { STATUS_MAP } from '../data/statuses';
import { hooksOf } from './hooks';
import { fsOf } from './effects';

/**
 * 索敌（DESIGN-FANTASY.md §5.3）：仇恨 softmax，概率永不为 0/1。
 * 特例：刺客被动反仇恨；猎犬优先易伤最多者。
 */

function aliveEnemies(ctx: BattleContext, unit: UnitRuntime): UnitRuntime[] {
  return ctx.state.units.filter((u) => u.alive && u.side !== unit.side);
}

function softmaxPick(ctx: BattleContext, cands: UnitRuntime[], weightOf: (u: UnitRuntime) => number): UnitRuntime {
  return ctx.rng.weighted(cands.map((u) => ({ item: u, weight: weightOf(u) })));
}

/** 常规索敌：P(i) = hate(i)^γ / Σ；刺客被动触发时 P(i) ∝ hate(i)^(−γ) */
export function pickEnemyTarget(ctx: BattleContext, unit: UnitRuntime): UnitRuntime | null {
  const cands = aliveEnemies(ctx, unit);
  if (cands.length === 0) return null;
  const g = FORMULAS.hateGamma;
  const inverse = hooksOf(unit).useInverseTargeting?.(ctx, unit) === true;
  if (inverse) {
    return softmaxPick(ctx, cands, (u) => Math.pow(u.stats['hate'] ?? 1, -g));
  }
  return softmaxPick(ctx, cands, (u) => Math.pow(u.stats['hate'] ?? 1, g));
}

/** 猎犬索敌：敌方存在易伤单位时永远攻击易伤层数最多者（并列随机），无视仇恨 */
export function pickEnemyTargetForPet(ctx: BattleContext, pet: UnitRuntime): UnitRuntime | null {
  const cands = aliveEnemies(ctx, pet);
  if (cands.length === 0) return null;
  const withVuln = cands.filter((u) => fsOf(u).some((s) => STATUS_MAP.get(s.id)?.vulnerable));
  if (withVuln.length === 0) {
    const g = FORMULAS.hateGamma;
    return softmaxPick(ctx, cands, (u) => Math.pow(u.stats['hate'] ?? 1, g));
  }
  const maxStacks = Math.max(...withVuln.map((u) => vulnerableCount(u)));
  const top = withVuln.filter((u) => vulnerableCount(u) === maxStacks);
  return ctx.rng.pick(top);
}

function vulnerableCount(u: UnitRuntime): number {
  let n = 0;
  for (const s of fsOf(u)) if (STATUS_MAP.get(s.id)?.vulnerable) n += 1;
  return n;
}

/** 治疗目标：随机受伤友方（含自己）。全员满血 → null（技能不可用，F14/Q15） */
export function pickInjuredAlly(ctx: BattleContext, unit: UnitRuntime): UnitRuntime | null {
  const cands = ctx.state.units.filter(
    (u) => u.alive && u.side === unit.side && u.stats['hp']! < u.stats['maxHp']!,
  );
  if (cands.length === 0) return null;
  return ctx.rng.pick(cands);
}

/** 增益目标：随机友方（含满血，F32） */
export function pickAlly(ctx: BattleContext, unit: UnitRuntime): UnitRuntime | null {
  const cands = ctx.state.units.filter((u) => u.alive && u.side === unit.side);
  if (cands.length === 0) return null;
  return ctx.rng.pick(cands);
}
