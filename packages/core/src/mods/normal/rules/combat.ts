import type { BattleContext, UnitRuntime } from '../../../engine';
import { FORMULAS } from '../data/formulas';
import { STATUS_MAP } from '../data/statuses';
import type { DamagePayload, EffectSpec, TargetKind } from '../types';
import { applyStatus, damageUnit, healUnit } from './effects';
import {
  applyModifyDamageCalc,
  applyModifySkillCost,
  applyModifyTargeting,
  fireOnDealDamage,
  fireOnDodge,
  fireOnKO,
  fireOnTakeDamage,
} from './hooks';
import { baseOf, effStat } from './stats';

// ---------- 目标选取 ----------

export function resolveTargets(ctx: BattleContext, unit: UnitRuntime, kind: TargetKind): UnitRuntime[] {
  const alive = ctx.state.units.filter((u) => u.alive);
  const allies = alive.filter((u) => u.side === unit.side);
  const enemies = alive.filter((u) => u.side !== unit.side);
  switch (kind) {
    case 'self':
      return [unit];
    case 'ally': {
      if (allies.length === 0) return [];
      const target = allies.reduce((a, b) =>
        b.stats['hp']! / b.stats['maxHp']! < a.stats['hp']! / a.stats['maxHp']! ? b : a,
      );
      return [target];
    }
    case 'allAllies':
      return allies;
    case 'allEnemies':
      return applyModifyTargeting(ctx, unit, enemies);
    case 'enemy': {
      if (enemies.length === 0) return [];
      const cands = applyModifyTargeting(ctx, unit, enemies);
      // 一半概率锁定残血（斩杀偏置），一半概率随机——避免永远集火同一个人（DESIGN.md #40）
      const target = ctx.rng.chance(FORMULAS.targetFocusBias)
        ? cands.reduce((a, b) => (b.stats['hp']! < a.stats['hp']! ? b : a))
        : ctx.rng.pick(cands);
      return [target];
    }
  }
}

// ---------- 命中与伤害 ----------

export function hitChance(attacker: UnitRuntime, defender: UnitRuntime): number {
  return clamp(
    1 - effStat(defender, 'dodge') + (effStat(attacker, 'spd') - effStat(defender, 'spd')) * FORMULAS.hitAgiCoef,
    FORMULAS.hitMin,
    1,
  );
}

export function rollHit(ctx: BattleContext, attacker: UnitRuntime, defender: UnitRuntime): boolean {
  return ctx.rng.chance(hitChance(attacker, defender));
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function variance(ctx: BattleContext): number {
  return FORMULAS.varianceMin + ctx.rng.next() * (FORMULAS.varianceMax - FORMULAS.varianceMin);
}

/** 伤害公式（DESIGN.md 7.7）：比值项保底、差值项让属性尾部真正强悍、hook 管道最后修正 */
export function calcDamage(
  ctx: BattleContext,
  attacker: UnitRuntime,
  defender: UnitRuntime,
  kind: 'phys' | 'magic',
  scale: number,
  crit: boolean,
  withVariance = true,
): number {
  const A = effStat(attacker, kind === 'phys' ? 'atk' : 'mag');
  const D = effStat(defender, kind === 'phys' ? 'pdef' : 'mdef');
  const ratio = A / (A + D);
  const aBase = kind === 'phys' ? baseOf(attacker).str : baseOf(attacker).wis;
  const dBase = kind === 'phys' ? baseOf(defender).vit : baseOf(defender).spr;
  const diff = 1 + Math.max(0, aBase - dBase) * FORMULAS.diffCoef;
  let amount = A * scale * ratio * diff * (withVariance ? variance(ctx) : 1);
  if (crit) amount *= effStat(attacker, 'critDmg');
  let p: DamagePayload = { amount, kind, attacker, defender, crit };
  p = applyModifyDamageCalc(ctx, attacker, p);
  p = applyModifyDamageCalc(ctx, defender, p);
  return Math.max(FORMULAS.minDamage, Math.round(p.amount));
}

// ---------- 结算 ----------

function attackTarget(
  ctx: BattleContext,
  attacker: UnitRuntime,
  defender: UnitRuntime,
  kind: 'phys' | 'magic',
  scale: number,
): void {
  if (!defender.alive) return;
  if (!rollHit(ctx, attacker, defender)) {
    ctx.emit('miss', { uid: defender.uid, attackerUid: attacker.uid }, [
      { target: `unit:${defender.uid}`, vfx: 'miss', durationMs: 550, logText: `@${defender.uid}@ 闪开了 @${attacker.uid}@ 的攻击！` },
    ]);
    fireOnDodge(ctx, defender, { attacker, defender });
    return;
  }
  const crit = ctx.rng.chance(Math.min(effStat(attacker, 'crit'), FORMULAS.critCap));
  const amount = calcDamage(ctx, attacker, defender, kind, scale, crit);
  const hpBefore = defender.stats['hp']!;
  damageUnit(ctx, defender, amount, { attackerUid: attacker.uid, crit });
  const actual = hpBefore - defender.stats['hp']!;
  const payload: DamagePayload = { amount: actual, kind, attacker, defender, crit };
  fireOnDealDamage(ctx, attacker, payload);
  if (defender.alive) fireOnTakeDamage(ctx, defender, payload);
}

function applyEffect(ctx: BattleContext, caster: UnitRuntime, effect: EffectSpec, targets: UnitRuntime[]): void {
  switch (effect.type) {
    case 'damage': {
      for (const t of targets) attackTarget(ctx, caster, t, effect.kind, effect.scale);
      break;
    }
    case 'heal': {
      for (const t of targets) healUnit(ctx, t, effStat(caster, 'mag') * effect.scale * variance(ctx));
      break;
    }
    case 'status': {
      const dests = effect.to === 'self' ? [caster] : targets;
      const def = STATUS_MAP.get(effect.status);
      for (const t of dests) {
        if (!t.alive || !ctx.rng.chance(effect.chance)) continue;
        let power = 0;
        if (def && (def.dot || def.shield)) {
          const src = effect.status === 'regen' ? 'spr' : 'mag';
          power = Math.max(1, Math.round(effStat(caster, src) * (effect.powerScale ?? 0.15)));
        }
        applyStatus(ctx, t, effect.status, effect.duration, power);
      }
      break;
    }
  }
}

/** 执行一个已选定的行动（含扣费、事件、结算、hook 触发）。返回结算中是否有单位倒下。 */
export function performAction(ctx: BattleContext, unit: UnitRuntime, ability: { id: string; name: string; vfx?: string; active: NonNullable<import('../types').ActiveSpec> }): void {
  ctx.emit('actionStart', { uid: unit.uid, name: unit.name }, [
    { target: `unit:${unit.uid}`, durationMs: 250 },
  ]);

  const act = ability.active;
  // 代价（血气激涌等 hook 在此改写）
  const plan = applyModifySkillCost(ctx, unit, { mp: act.mpCost, hp: 0 });
  if (plan.mp > 0) {
    unit.stats['mp'] = Math.max(0, unit.stats['mp']! - plan.mp);
    ctx.emit('statChange', { uid: unit.uid, stat: 'mp', value: unit.stats['mp']! }, []);
  }
  if (plan.hp > 0) {
    // 不允许被自己的能力扣死（保留 1 点生命）
    unit.stats['hp'] = Math.max(1, unit.stats['hp']! - plan.hp);
    ctx.emit('statChange', { uid: unit.uid, stat: 'hp', value: unit.stats['hp']! }, [
      { target: `unit:${unit.uid}`, durationMs: 300, logText: `${unit.name} 燃烧了 ${plan.hp} 点生命！` },
    ]);
  }
  if (act.cooldown > 0) {
    (unit.meta['cd'] as Record<string, number>)[ability.id] = act.cooldown;
  }

  const targets = resolveTargets(ctx, unit, act.target);
  ctx.emit('skillUse', { uid: unit.uid, ability: ability.id, abilityName: ability.name, targets: targets.map((t) => t.uid) }, [
    {
      target: targets.length === 1 ? `unit:${targets[0]!.uid}` : `side:${unit.side}`,
      vfx: ability.vfx,
      durationMs: 700,
      logText: `@${unit.uid}@ 使用了「${ability.name}」`,
    },
  ]);

  for (const effect of act.effects) {
    applyEffect(ctx, unit, effect, targets);
  }
}

// ---------- 回合收尾 ----------

/** 回合结束：MP 回复、DoT 结算、持续时间与冷却递减 */
export function endRound(ctx: BattleContext): void {
  for (const u of ctx.state.units) {
    if (!u.alive) continue;
    const regen = FORMULAS.mpRegenBase + baseOf(u).spr * FORMULAS.mpRegenSpr;
    if (u.stats['mp']! < u.stats['maxMp']!) {
      u.stats['mp'] = Math.min(u.stats['maxMp']!, u.stats['mp']! + Math.round(regen));
      ctx.emit('statChange', { uid: u.uid, stat: 'mp', value: u.stats['mp']! }, []);
    }
    const cd = u.meta['cd'] as Record<string, number>;
    for (const k of Object.keys(cd)) cd[k] = Math.max(0, cd[k]! - 1);

    for (const s of [...u.statuses]) {
      const def = STATUS_MAP.get(s.id);
      if (def?.dot === 'damage') {
        damageUnit(ctx, u, s.power, { source: def.name });
      } else if (def?.dot === 'heal') {
        healUnit(ctx, u, s.power, def.name);
      }
      if (!u.alive) break;
      s.remain -= 1;
      if (s.remain <= 0) {
        u.statuses = u.statuses.filter((x) => x !== s);
        ctx.emit('statusRemove', { uid: u.uid, status: s.id }, [
          { target: `unit:${u.uid}`, durationMs: 250, logText: `@${u.uid}@ 的【${def?.name ?? s.id}】效果结束了` },
        ]);
      }
    }
  }
  ctx.emit('roundEnd', { round: ctx.state.round }, [{ durationMs: 300 }]);
}

// ---------- onKO 触发点 ----------

/** 在调用 die() 之后立即触发 onKO hook（不死鸟在此复活） */
export function fireKOHooks(ctx: BattleContext, unit: UnitRuntime): void {
  fireOnKO(ctx, unit);
}
