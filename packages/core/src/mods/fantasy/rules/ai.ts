import type { BattleContext, UnitRuntime } from '../../../engine';
import type { SkillDef, StatusEffect } from '../types';
import { getSkill } from '../abilities';
import { FORMULAS } from '../data/formulas';
import { STATUS_MAP } from '../data/statuses';
import { applyStatusInstance, healUnit } from './effects';
import { attackOnce, ailmentChance, effStat, favor } from './combat';
import { hooksOf } from './hooks';
import { summonPet } from './setup';
import { pickAlly, pickEnemyTarget, pickEnemyTargetForPet, pickInjuredAlly } from './targeting';

/**
 * AI（DESIGN-FANTASY.md §5.8，Q15 裁定）：无权重、无优先级。
 * 唯一硬规则：无有效目标则不可选（全员满血 → 治疗类不可用）。
 */

interface CharLike {
  name: string;
  skills: { id: string }[];
}

function charOf(unit: UnitRuntime): CharLike {
  return unit.char as CharLike;
}

function isPet(unit: UnitRuntime): boolean {
  return unit.meta['pet'] === true;
}

/** 目标是否有效（决定技能可用性） */
function hasValidTarget(ctx: BattleContext, unit: UnitRuntime, skill: SkillDef): boolean {
  const t = skill.active!.target;
  if (t === 'enemy') return ctx.state.units.some((u) => u.alive && u.side !== unit.side);
  if (t === 'allyInjured') return ctx.state.units.some((u) => u.alive && u.side === unit.side && u.stats['hp']! < u.stats['maxHp']!);
  if (t === 'ally') return ctx.state.units.some((u) => u.alive && u.side === unit.side);
  return true; // self
}

function usableActives(ctx: BattleContext, unit: UnitRuntime): SkillDef[] {
  const out: SkillDef[] = [];
  for (const cs of charOf(unit).skills) {
    const def = getSkill(cs.id);
    if (def?.kind === 'active' && def.active && hasValidTarget(ctx, unit, def)) out.push(def);
  }
  return out;
}

/** 等概率随机选一个可用主动技 */
export function chooseSkill(ctx: BattleContext, unit: UnitRuntime): SkillDef | null {
  const list = usableActives(ctx, unit);
  if (list.length === 0) return null;
  return ctx.rng.pick(list);
}

/** 发动技能入口：吟唱技先入咏唱（迅咏被动可瞬发），否则立即结算 */
export function performSkill(ctx: BattleContext, unit: UnitRuntime, skill: SkillDef): void {
  const act = skill.active!;
  if (act.cast) {
    if (hooksOf(unit).skipCast?.(ctx, unit) === true) {
      ctx.emit('log', { uid: unit.uid, type: 'quickcast' }, [
        { target: `unit:${unit.uid}`, durationMs: 350, logText: `✨ @${unit.uid}@ 的「${skill.name}」瞬发！` },
      ]);
      executeSkill(ctx, unit, skill, 0);
    } else {
      const need = act.cast.base + ctx.rng.next() * act.cast.rollMax;
      unit.meta['casting'] = { skillId: skill.id, need, prog: 0 };
      ctx.emit('skillUse', { uid: unit.uid, ability: skill.id, abilityName: skill.name, casting: true }, [
        { target: `unit:${unit.uid}`, durationMs: 500, logText: `🌀 @${unit.uid}@ 开始咏唱「${skill.name}」……` },
      ]);
    }
    return;
  }
  executeSkill(ctx, unit, skill, 0);
}

/** 技能结算：选目标 → 逐效果执行（伤害/追击/吸血/状态/召唤）。castTicks=实际吟唱耗时（黑魔增伤用） */
export function executeSkill(ctx: BattleContext, unit: UnitRuntime, skill: SkillDef, castTicks: number): void {
  const act = skill.active!;
  ctx.emit('skillUse', { uid: unit.uid, ability: skill.id, abilityName: skill.name, targets: [] }, [
    { target: `unit:${unit.uid}`, vfx: skill.vfx, durationMs: 650, logText: `@${unit.uid}@ ${castTicks > 0 ? '咏唱完毕，发动了' : '使用了'}「${skill.name}」` },
  ]);

  for (const eff of act.effects) {
    if (!unit.alive) return;
    switch (eff.type) {
      case 'damage': {
        const target = isPet(unit) ? pickEnemyTargetForPet(ctx, unit) : pickEnemyTarget(ctx, unit);
        if (!target) return;
        const scale = eff.scale + (act.castScale && castTicks > 0 ? (castTicks / (act.castDivisor ?? 600)) * act.castScale : 0);
        if (eff.chase) {
          let segments = 0;
          for (let i = 0; i < eff.chase.max; i++) {
            attackOnce(ctx, unit, target, scale, { source: skill.name, viaCast: castTicks > 0, drainRatio: act.drainRatio });
            segments += 1;
            if (!unit.alive || !target.alive) break;
            if (i < eff.chase.max - 1 && !ctx.rng.chance(favor(ctx, unit, eff.chase.p))) break;
          }
          if (segments > 1) {
            ctx.emit('log', { uid: unit.uid, type: 'combo', count: segments }, [
              { target: `unit:${unit.uid}`, durationMs: 300, logText: `🔥 @${unit.uid}@ 打出了 ×${segments} 连击！` },
            ]);
          }
        } else {
          attackOnce(ctx, unit, target, scale, { source: skill.name, viaCast: castTicks > 0, drainRatio: act.drainRatio });
        }
        break;
      }
      case 'heal': {
        const target = act.target === 'self' ? unit : pickInjuredAlly(ctx, unit);
        if (!target) return;
        const v = FORMULAS.varianceMin + ctx.rng.next() * (FORMULAS.varianceMax - FORMULAS.varianceMin);
        const healed = healUnit(ctx, target, effStat(unit, 'atk') * eff.scale * v, skill.name);
        hooksOf(unit).onHealDone?.(ctx, unit, target, healed);
        break;
      }
      case 'status': {
        const targets = eff.to === 'self' || act.target === 'self' ? [unit] : resolveStatusTargets(ctx, unit, act.target);
        for (const t of targets) {
          if (!t?.alive) continue;
          applySkillStatus(ctx, unit, t, eff);
        }
        break;
      }
      case 'summon': {
        summonPet(ctx, unit, eff.pet);
        break;
      }
    }
  }
}

function resolveStatusTargets(ctx: BattleContext, unit: UnitRuntime, target: string): (UnitRuntime | null)[] {
  if (target === 'enemy') {
    const t = isPet(unit) ? pickEnemyTargetForPet(ctx, unit) : pickEnemyTarget(ctx, unit);
    return [t];
  }
  if (target === 'allyInjured') return [pickInjuredAlly(ctx, unit)];
  if (target === 'ally') return [pickAlly(ctx, unit)];
  return [unit];
}

function applySkillStatus(ctx: BattleContext, caster: UnitRuntime, target: UnitRuntime, eff: StatusEffect): void {
  const sid = eff.pool ? ctx.rng.pick(eff.pool) : eff.status;
  const def = STATUS_MAP.get(sid);
  if (!def) return;
  // 判定按状态极性分流：给敌人的负面走 ailmentChance（软上限 ~80%，F38/F39）；增益走 favor（可必中）
  const pass =
    def.kind === 'debuff'
      ? ctx.rng.chance(ailmentChance(ctx, caster, eff.chance, eff.ailmentScale ?? 1))
      : ctx.rng.chance(favor(ctx, caster, eff.chance, 0, 1));
  if (!pass) return;
  let power = 0;
  let pct = eff.pct ?? def.pct;
  if (def.dot === 'damage' && def.dotKind === 'flat' && eff.powerScaleAtk) {
    power = Math.max(1, Math.round(effStat(caster, 'atk') * eff.powerScaleAtk));
  } else if (def.dot === 'heal' && def.dotKind === 'flat' && eff.powerScaleAtk) {
    power = Math.max(1, Math.round(effStat(caster, 'atk') * eff.powerScaleAtk));
  } else if (def.dot === 'damage' && def.dotKind === 'flat' && !eff.powerScaleAtk) {
    power = Math.max(1, Math.round(effStat(caster, 'atk') * 0.1)); // 兜底强度
  }
  pct = pct ?? 0;
  const ok = applyStatusInstance(ctx, target, sid, { sourceUid: caster.uid, power, pct });
  if (ok && def.kind === 'buff') {
    hooksOf(caster).onBuffApplied?.(ctx, caster, target, sid);
  }
}

/** 供职业技能 hook 复用：从池中随机施加一个状态（药师药理/诗人战歌/舞娘双重舞步等） */
export function applyRandomStatusFromPool(
  ctx: BattleContext,
  caster: UnitRuntime,
  target: UnitRuntime,
  pool: string[],
  flatScale = 0.1,
  chance = 1,
  ailScale = 1,
): void {
  applySkillStatus(ctx, caster, target, { type: 'status', status: pool[0]!, pool, chance, ailmentScale: ailScale, powerScaleAtk: flatScale });
}
