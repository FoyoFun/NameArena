import type { BattleContext, UnitRuntime } from '../../../engine';
import { FORMULAS } from '../data/formulas';
import { STATUS_MAP } from '../data/statuses';
import type { CombatKey, DamagePayload } from '../types';
import { damageUnit, fsOf, healUnit } from './effects';
import { hooksOf } from './hooks';

// ---------- 属性取值 ----------

/**
 * 有效属性 = (基础派生快照 + Σ固定) × (1 + Σ比例)，最后统一钳制（F25/F26）。
 * 仇恨不吃任何修正（F12）。
 */
export function effStat(unit: UnitRuntime, key: CombatKey | 'hate'): number {
  if (key === 'hate') return unit.stats['hate'] ?? 1;
  const base = unit.stats[key] ?? 0;
  let prop = 0;
  for (const inst of fsOf(unit)) {
    const m = STATUS_MAP.get(inst.id)?.statMods?.[key];
    if (m !== undefined) prop += m;
  }
  let v = base * (1 + prop);
  const c = (FORMULAS.clamp as Record<string, { min: number; max: number } | undefined>)[key];
  if (c) v = Math.min(c.max, Math.max(c.min, v));
  return v;
}

/** 天选加成 pt（§4.2：软曲线，无封顶但不破各概率自身上限） */
export function destinyPt(unit: UnitRuntime): number {
  const d = effStat(unit, 'destiny');
  return (FORMULAS.destinyAmp * d) / (d + FORMULAS.destinyB);
}

/** 双曲软上限：raw ≤ cap 原样；超过后逼近 1 但极难到达（raw−cap 每翻一倍才逼近一段） */
export function softCap(raw: number, cap: number): number {
  if (raw <= cap) return Math.max(0, raw);
  const x = raw - cap;
  return cap + (1 - cap) * (x / (x + (1 - cap)));
}

/**
 * 给敌人施加负面状态的概率（F38/F39/F44）：
 * 基础 + 异常率×技能系数 + 自己的天选pt（只有施法者的天选生效，F43），
 * 过 0.8 软上限后，天选再按 ailmentBreakCoef（放大档）补足 80~100 区间。
 */
export function ailmentChance(ctx: BattleContext, caster: UnitRuntime, base: number, ailmentScale = 1): number {
  const pt = destinyPt(caster);
  const raw = base + effStat(caster, 'ailment') * ailmentScale + pt;
  return Math.min(1, softCap(raw, FORMULAS.ailmentSoftCap) + pt * FORMULAS.ailmentBreakCoef);
}

/** 己方有利判定的统一入口：基础概率 + 天选pt（钳到 [floor, cap]），再按突破系数补足可越过 cap（F44） */
export function favor(ctx: BattleContext, unit: UnitRuntime, base: number, floor = 0, cap = 1): number {
  const pt = destinyPt(unit);
  const clamped = Math.min(cap, Math.max(floor, base + pt));
  return Math.min(1, clamped + pt * FORMULAS.destinyBreakCoef);
}

export function clockOf(ctx: BattleContext): number {
  return (ctx.state.scratch['clock'] as number | undefined) ?? 0;
}

export function vulnerableStacks(unit: UnitRuntime): number {
  let n = 0;
  for (const inst of fsOf(unit)) if (STATUS_MAP.get(inst.id)?.vulnerable) n += 1;
  return n;
}

// ---------- 命中与伤害 ----------

/**
 * 命中（主人裁定 F43/F44）：
 * - 无守方天选差值——天选不做"攻−守"运算，只作用于各自的有利面；
 * - 闪避突破：守方自己的天选延伸自己的闪避上限（守方的有利面）；
 * - 命中突破：攻方天选在钳制后再补足，可突破 90% 上限逼近必中。
 */
export function hitChance(ctx: BattleContext, attacker: UnitRuntime, defender: UnitRuntime): number {
  const dodgeEff = Math.min(1, effStat(defender, 'dodge') + destinyPt(defender) * FORMULAS.destinyBreakCoef);
  const v = FORMULAS.hitBase + effStat(attacker, 'hit') - dodgeEff + destinyPt(attacker);
  const clamped = Math.min(FORMULAS.hitCap, Math.max(FORMULAS.hitFloor, v));
  return Math.min(1, clamped + destinyPt(attacker) * FORMULAS.destinyBreakCoef);
}

function variance(ctx: BattleContext): number {
  return FORMULAS.varianceMin + ctx.rng.next() * (FORMULAS.varianceMax - FORMULAS.varianceMin);
}

/** 伤害公式（§4.3）：攻×倍率×攻/(攻+防)×波动×易伤×暴击×乱战规模，攻方输出 hook → 守方承伤 hook */
export function calcDamage(
  ctx: BattleContext,
  attacker: UnitRuntime,
  defender: UnitRuntime,
  scale: number,
  crit: boolean,
): number {
  const A = effStat(attacker, 'atk');
  const D = effStat(defender, 'def');
  const ratio = A / (A + D);
  const vuln = 1 + vulnerableStacks(defender) * FORMULAS.vulnerablePerStack;
  const size = 1 + FORMULAS.meleeSizeBonus * (((ctx.state.scratch['initialCount'] as number | undefined) ?? 2) - 2);
  let amount = A * scale * ratio * vuln * size * variance(ctx);
  if (crit) amount *= FORMULAS.critMult;
  amount = hooksOf(attacker).modifyDamageOut?.(ctx, attacker, amount) ?? amount;
  amount = hooksOf(defender).modifyIncomingDamage?.(ctx, defender, amount, attacker) ?? amount;
  return Math.max(FORMULAS.minDamage, Math.round(amount));
}

export interface AttackOpts {
  /** 来源技能名（战报） */
  source?: string;
  viaCast?: boolean;
  /** 伤害转自身生命比例（吸血） */
  drainRatio?: number;
  /** 反击伤害不再触发受害方反击 hook（防无限互反） */
  isCounter?: boolean;
}

/**
 * 单段攻击：命中 → 暴击 → 伤害 → 吸血 → hook。
 * 命中段使连击 +1；被闪避则攻击者连击清零（Q11）。Miss 不影响技能内后续段（由调用方控制）。
 */
export function attackOnce(ctx: BattleContext, attacker: UnitRuntime, defender: UnitRuntime, scale: number, opts: AttackOpts = {}): boolean {
  if (!attacker.alive || !defender.alive) return false;
  if (!ctx.rng.chance(hitChance(ctx, attacker, defender))) {
    attacker.meta['combo'] = 0;
    ctx.emit('miss', { uid: defender.uid, attackerUid: attacker.uid }, [
      { target: `unit:${defender.uid}`, vfx: 'miss', durationMs: 550, logText: `@${defender.uid}@ 闪开了 @${attacker.uid}@ 的攻击！` },
    ]);
    return false;
  }
  const crit = ctx.rng.chance(favor(ctx, attacker, effStat(attacker, 'crit'), FORMULAS.clamp.crit.min, FORMULAS.clamp.crit.max));
  const amount = calcDamage(ctx, attacker, defender, scale, crit);
  damageUnit(ctx, defender, amount, { attackerUid: attacker.uid, crit, source: opts.source });
  attacker.meta['combo'] = ((attacker.meta['combo'] as number | undefined) ?? 0) + 1;
  attacker.meta['lastHarmTick'] = clockOf(ctx);
  if (opts.drainRatio && opts.drainRatio > 0) {
    healUnit(ctx, attacker, amount * opts.drainRatio, '吸血');
  }
  const p: DamagePayload = { amount, attacker, defender, crit, source: opts.source, viaCast: opts.viaCast };
  fireDealt(ctx, attacker, p);
  if (defender.alive && !opts.isCounter) {
    hooksOf(defender).onTakenDamage?.(ctx, defender, p);
  }
  return true;
}

function fireDealt(ctx: BattleContext, attacker: UnitRuntime, p: DamagePayload): void {
  hooksOf(attacker).onDealtDamage?.(ctx, attacker, p);
  // 召唤物造成伤害时，同步触发主人的 onDealtDamage（猎人猎印记："自己与自己的召唤单位"）
  const ownerUid = attacker.meta['summonerUid'] as string | undefined;
  if (ownerUid) {
    const owner = ctx.state.units.find((u) => u.uid === ownerUid);
    if (owner?.alive) hooksOf(owner).onDealtDamage?.(ctx, owner, p);
  }
}
