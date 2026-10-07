import { makeUnit } from '../../../engine';
import type { BattleContext, Ruleset, UnitConfig, UnitRuntime } from '../../../engine';
import { getSkill } from '../abilities';
import { FANTASY_BOSSES, FANTASY_BOSS_MAP } from '../data/bosses';
import { FORMULAS } from '../data/formulas';
import { JOBS, JOB_MAP } from '../data/jobs';
import { STATUS_MAP } from '../data/statuses';
import { generateFantasyCharacter } from '../generation';
import type { FantasyGenOpts } from '../generation';
import type { Character } from '../types';
import { bossCharacter } from '../data/bosses';
import { chooseSkill, executeSkill, performSkill } from './ai';
import { destinyPt, effStat, favor } from './combat';
import { damageUnit, fsOf, healUnit, removeStatusInst } from './effects';
import { hooksOf } from './hooks';
import { initUnit, unitSnapshot, weightOf } from './setup';

/**
 * 幻想大乱斗 ATB 规则集（DESIGN-FANTASY.md §5）。
 * 引擎只驱动 nextAction 直到 isOver；本文件拥有全部战斗流程。
 * 时间模型：整数 tick；每 tick 全体推进 速度 点 ATB/吟唱；引擎直接跳到下一事件时刻。
 */

interface PendingEvent {
  uid: string;
  kind: 'cast' | 'turn';
}

interface CastingState {
  skillId: string;
  need: number;
  prog: number;
}

// ---------- 终局与行动时钟 ----------

function sides(ctx: BattleContext): string[] {
  return [...new Set(ctx.state.units.map((u) => u.side))];
}

/** 初始在场单位（不含召唤物）——败北判定与分数只看他们（§5.6/§6.2） */
function initialUnits(ctx: BattleContext): UnitRuntime[] {
  return ctx.state.units.filter((u) => u.meta['pet'] !== true);
}

function actionsOf(ctx: BattleContext): number {
  return (ctx.state.scratch['actions'] as number | undefined) ?? 0;
}

function sideScore(ctx: BattleContext, side: string): number {
  return (
    initialUnits(ctx)
      .filter((u) => u.side === side)
      .reduce((sum, u) => sum + u.stats['hp']! / u.stats['maxHp']!, 0) * 100
  );
}

function sideMembersText(ctx: BattleContext, side: string): string {
  return ctx.state.units
    .filter((u) => u.side === side)
    .map((u) => `@${u.uid}@`)
    .join('、');
}

function endBattle(ctx: BattleContext, winner: string | null, reason: 'wipe' | 'attrition' | 'stalemate'): void {
  if (ctx.state.over) return;
  ctx.state.over = true;
  ctx.state.winner = winner;
  const scores = Object.fromEntries(sides(ctx).map((s) => [s, Math.round(sideScore(ctx, s) * 10) / 10]));
  const result = { winner, rounds: Math.floor(actionsOf(ctx)), reason };
  ctx.state.scratch['result'] = result;
  ctx.state.scratch['scores'] = scores;
  const reasonText = reason === 'wipe' ? '全歼' : reason === 'attrition' ? '到达行动数上限，按剩余生命判定' : '僵局';
  const winText = winner === null ? '🤝 平局！' : `🏆 【${sideMembersText(ctx, winner)}】(${winner} 方) 获胜！`;
  ctx.emit('battleEnd', { ...result, scores }, [
    { durationMs: 1500, logText: `${winText} —— ${reasonText}，共 ${Math.floor(actionsOf(ctx))} 次行动` },
  ]);
}

/** 一方初始单位全部死亡 → 败北；同时全灭 → 平局 */
function checkWipe(ctx: BattleContext): void {
  const all = sides(ctx);
  const wiped = all.filter((s) => {
    const own = initialUnits(ctx).filter((u) => u.side === s);
    return own.length > 0 && !own.some((u) => u.alive);
  });
  if (wiped.length === 0) return;
  if (wiped.length >= all.length) {
    endBattle(ctx, null, 'wipe');
    return;
  }
  endBattle(ctx, all.find((s) => !wiped.includes(s))!, 'wipe');
}

/** 行动数结算（阶段6 / 多动追加），超封顶按分数判定（允许平局） */
function addAction(ctx: BattleContext, weight: number): void {
  if (ctx.state.over) return;
  ctx.state.scratch['actions'] = actionsOf(ctx) + weight;
  const cap = ctx.state.scratch['cap'] as number;
  if (actionsOf(ctx) < cap) return;
  const scored = sides(ctx).map((s) => ({ side: s, score: sideScore(ctx, s) }));
  const best = Math.max(...scored.map((x) => x.score));
  const top = scored.filter((x) => Math.abs(x.score - best) < 1e-9);
  endBattle(ctx, top.length === 1 ? top[0]!.side : null, 'attrition');
}

// ---------- 时间推进 ----------

/** 需要推进 ATB 的单位：活人；死人仅当持有复活被动（F30，行为等价的性能优化） */
function shouldAdvance(ctx: BattleContext, unit: UnitRuntime): boolean {
  if (unit.alive) return true;
  return (hooksOf(unit).reviveChance?.(ctx, unit) ?? 0) > 0;
}

function timeToEvent(unit: UnitRuntime): number {
  const spd = Math.max(1, effStat(unit, 'spd'));
  const casting = unit.meta['casting'] as CastingState | null;
  if (unit.alive && casting) {
    return Math.max(1, Math.ceil((casting.need - casting.prog) / spd));
  }
  const atb = unit.meta['atb'] as number;
  return Math.max(1, Math.ceil((FORMULAS.atbMax - atb) / spd));
}

/** 快进 delta ticks（跳到下一事件时刻），收集本时刻的事件并排序入 pending */
function advanceTime(ctx: BattleContext): void {
  const cands = ctx.state.units.filter((u) => shouldAdvance(ctx, u));
  if (cands.length === 0) {
    endBattle(ctx, null, 'stalemate');
    return;
  }
  const delta = Math.min(...cands.map(timeToEvent));
  ctx.state.scratch['clock'] = ((ctx.state.scratch['clock'] as number | undefined) ?? 0) + delta;
  const events: PendingEvent[] = [];
  for (const u of cands) {
    const spd = effStat(u, 'spd');
    u.meta['atb'] = (u.meta['atb'] as number) + spd * delta;
    const casting = u.meta['casting'] as CastingState | null;
    if (u.alive && casting) {
      casting.prog += spd * delta;
      if (casting.prog >= casting.need) events.push({ uid: u.uid, kind: 'cast' });
    } else if ((u.meta['atb'] as number) >= FORMULAS.atbMax) {
      events.push({ uid: u.uid, kind: 'turn' });
    }
  }
  const byUid = new Map(ctx.state.units.map((u) => [u.uid, u]));
  // 同刻排序：吟唱完成先于 ATB 回合；同级按溢出量降序、再按 uid 稳定序
  events.sort((a, b) => {
    if (a.kind !== b.kind) return a.kind === 'cast' ? -1 : 1;
    const oa = overflowOf(byUid.get(a.uid)!, a.kind);
    const ob = overflowOf(byUid.get(b.uid)!, b.kind);
    if (oa !== ob) return ob - oa;
    return a.uid < b.uid ? -1 : 1;
  });
  ctx.state.scratch['pending'] = events;
}

function overflowOf(u: UnitRuntime, kind: PendingEvent['kind']): number {
  if (kind === 'cast') {
    const c = u.meta['casting'] as CastingState | null;
    return c ? c.prog - c.need : 0;
  }
  return (u.meta['atb'] as number) - FORMULAS.atbMax;
}

// ---------- 八阶段回合流程 ----------

/** 阶段8：复活判定（死亡单位 ATB 满 → 在此 roll 复活被动，无次数上限 F 裁定） */
function tryRevive(ctx: BattleContext, unit: UnitRuntime): void {
  const chance = hooksOf(unit).reviveChance?.(ctx, unit) ?? 0;
  if (chance <= 0) return;
  if (ctx.rng.chance(favor(ctx, unit, chance))) {
    unit.alive = true;
    unit.stats['hp'] = 1;
    ctx.emit('heal', { uid: unit.uid, amount: 1, hp: 1, maxHp: unit.stats['maxHp']!, source: '复活' }, [
      { target: `unit:${unit.uid}`, vfx: 'heal', durationMs: 900, logText: `🌟 @${unit.uid}@ 在灰烬中站起，以 1 点生命复活了！` },
    ]);
  }
}

/** 阶段3a：控制结算。返回 true = 本回合主动行动被跳过 */
function settleControl(ctx: BattleContext, unit: UnitRuntime): boolean {
  const controlInsts = fsOf(unit).filter((i) => STATUS_MAP.get(i.id)?.control);
  if (controlInsts.length === 0) return false;
  const def = STATUS_MAP.get(controlInsts[0]!.id)!;
  // 消耗最旧一个 fixed 控件（眩晕/冰冻的"1回合"即本回合）；昏厥(resist)不消耗——直到抵抗成功
  const fixed = controlInsts.find((i) => STATUS_MAP.get(i.id)?.durationType === 'fixed');
  if (fixed) removeStatusInst(ctx, unit, fixed, 'consume');
  ctx.emit('log', { uid: unit.uid, type: 'skip' }, [
    { target: `unit:${unit.uid}`, vfx: 'stun', durationMs: 700, logText: `💫 @${unit.uid}@ #${def.name}#中，无法行动！` },
  ]);
  return true;
}

/** 阶段3b：DoT/HOT tick（逐实例，可致死）。返回 false = 单位已死 */
function tickDots(ctx: BattleContext, unit: UnitRuntime): boolean {
  for (const inst of [...fsOf(unit)]) {
    const def = STATUS_MAP.get(inst.id);
    if (!def?.dot) continue;
    if (def.dot === 'damage') {
      if (def.dotKind === 'pctCurrent') {
        const pct = inst.power || def.pct || 0.04;
        damageUnit(ctx, unit, Math.max(1, Math.round(unit.stats['hp']! * pct)), { source: `【${def.name}】` });
      } else {
        damageUnit(ctx, unit, inst.power, { source: `【${def.name}】` });
      }
    } else {
      healUnit(ctx, unit, inst.power, def.name);
    }
    if (!unit.alive) return false;
  }
  return true;
}

/** 阶段5：状态时长结算（fixed 递减 / resist 抵抗 / absorb 吸收；grace 首次免 roll，F5） */
function settleStatuses(ctx: BattleContext, unit: UnitRuntime): void {
  const dpt = destinyPt(unit);
  for (const inst of [...fsOf(unit)]) {
    const def = STATUS_MAP.get(inst.id);
    if (!def) continue;
    if (def.durationType === 'fixed') {
      if (def.control) continue; // 控制型已在阶段3 消耗
      inst.remain -= 1;
      if (inst.remain <= 0) removeStatusInst(ctx, unit, inst, 'expire');
    } else if (def.durationType === 'resist') {
      if (inst.grace) {
        inst.grace = false;
        continue;
      }
      inst.elapsed += 1;
      const clamped = Math.min(FORMULAS.resistCap, Math.max(0, effStat(unit, 'resist') + dpt + inst.elapsed * FORMULAS.resistGainPerTurn));
      const p = Math.min(1, clamped + dpt * FORMULAS.destinyBreakCoef); // 天选可突破 95% 上限（F44）
      if (ctx.rng.chance(p)) removeStatusInst(ctx, unit, inst, 'resist');
    } else {
      if (inst.grace) {
        inst.grace = false;
        continue;
      }
      inst.elapsed += 1;
      const clamped = Math.min(FORMULAS.absorbCap, Math.max(FORMULAS.absorbFloor, effStat(unit, 'absorb') + dpt - inst.elapsed * FORMULAS.absorbDecayPerTurn));
      const p = Math.min(1, clamped + dpt * FORMULAS.destinyBreakCoef); // 天选可突破 95% 上限（F44）
      if (!ctx.rng.chance(p)) removeStatusInst(ctx, unit, inst, 'absorb');
    }
  }
}

function processTurn(ctx: BattleContext, unit: UnitRuntime): void {
  // 阶段1：回合开始前判定——死亡 debuff 100% 判定，直接跳阶段8（不经行动数结算，F8/F30）
  if (!unit.alive) {
    unit.meta['atb'] = (unit.meta['atb'] as number) - FORMULAS.atbMax;
    tryRevive(ctx, unit);
    return;
  }

  // 阶段2：回合开始
  unit.meta['atb'] = (unit.meta['atb'] as number) - FORMULAS.atbMax;
  ctx.emit('actionStart', { uid: unit.uid, name: unit.name, actions: Math.round(actionsOf(ctx)), cap: ctx.state.scratch['cap'] }, [
    { target: `unit:${unit.uid}`, durationMs: 250 },
  ]);

  // 阶段3：回合开始后判定——控制结算 + DoT/HOT
  const skip = settleControl(ctx, unit);
  if (!tickDots(ctx, unit)) {
    checkWipe(ctx);
    return;
  }

  // 阶段4：主动行动（+多动追加，每次追加 +0.8×权重；发起吟唱后本回合不再追加，F31）
  if (!skip) {
    const extra = Math.min(FORMULAS.maxExtraActions, hooksOf(unit).extraActions?.(ctx, unit) ?? 0);
    for (let i = 0; i <= extra; i++) {
      if (i > 0) {
        addAction(ctx, FORMULAS.extraActionWeight * weightOf(unit));
        if (ctx.state.over) return;
      }
      const skill = chooseSkill(ctx, unit);
      if (!skill) break;
      performSkill(ctx, unit, skill);
      if (ctx.state.over) return;
      if (!unit.alive || unit.meta['casting']) break;
    }
    if (!unit.alive) {
      checkWipe(ctx);
      return;
    }
  }

  // 阶段5：回合结束前判定——状态时长/抵抗/吸收
  settleStatuses(ctx, unit);

  // 阶段6：行动数结算（含被控跳过的回合；死亡单位不经此阶段）
  addAction(ctx, weightOf(unit));

  // 阶段7：回合结束 / 阶段8：复活判定（死亡单位已在阶段1 分支处理）
}

function processCast(ctx: BattleContext, unit: UnitRuntime): void {
  const casting = unit.meta['casting'] as CastingState | null;
  if (!unit.alive || !casting) return;
  unit.meta['casting'] = null;
  const skill = getSkill(casting.skillId);
  if (!skill?.active) return;
  // 实际耗时 = 标称时长 / 速度（F6：速度越快耗时越短——黑魔伤害越低，速度是双刃剑）
  const actualTicks = casting.need / Math.max(1, effStat(unit, 'spd'));
  executeSkill(ctx, unit, skill, actualTicks);
}

// ---------- Ruleset ----------

export function fantasyRuleset(kind: 'pvp' | 'pve', genKey: string, genVersion: number): Ruleset {
  return {
    initBattle(ctx) {
      ctx.state.scratch['clock'] = 0;
      ctx.state.scratch['actions'] = 0;
      ctx.state.scratch['pending'] = [] as PendingEvent[];
      ctx.state.scratch['petSeq'] = 0;

      let initialCount = 0;
      for (const team of ctx.config.teams) {
        let unitCfgs: (UnitConfig & { char?: unknown })[] = team.units as (UnitConfig & { char?: unknown })[];
        // PVE 的 B 方由 Boss 数据重建（config 里只是名字占位）
        if (kind === 'pve' && team.side === 'B') {
          const def = FANTASY_BOSS_MAP.get(ctx.config.bossId ?? '') ?? FANTASY_BOSSES[0]!;
          unitCfgs = def.units.map((u) => ({ name: u.name, side: team.side, char: bossCharacter(u) }));
        }
        unitCfgs.forEach((uc, i) => {
          const char =
            (uc.char as Character | undefined) ??
            generateFantasyCharacter(uc.name, genKey, genVersion, uc.opts as FantasyGenOpts | undefined);
          const job = JOB_MAP.get(char.jobId);
          const hate = job ? job.hate / 1000 : 1;
          const unit = makeUnit(`${team.side}-${i + 1}`, team.side, char.name, char, uc.owner);
          initUnit(ctx, unit, char, hate);
          ctx.state.units.push(unit);
          initialCount += 1;
        });
      }
      ctx.state.scratch['initialCount'] = initialCount;
      ctx.state.scratch['cap'] = kind === 'pve' ? FORMULAS.pveActionsCap : initialCount * FORMULAS.actionsCapPerUnit;

      ctx.emit(
        'battleStart',
        { units: ctx.state.units.map(unitSnapshot), modId: ctx.config.modId, kind: ctx.config.kind, cap: ctx.state.scratch['cap'] },
        [
          {
            vfx: 'stage',
            durationMs: 1300,
            logText: `⚔️ 对阵：【${sideMembersText(ctx, 'A')}】 vs 【${sideMembersText(ctx, 'B')}】`,
          },
        ],
      );
    },

    nextAction(ctx) {
      if (ctx.state.over) return;
      let pending = (ctx.state.scratch['pending'] as PendingEvent[] | undefined) ?? [];
      if (pending.length === 0) {
        advanceTime(ctx);
        pending = (ctx.state.scratch['pending'] as PendingEvent[]) ?? [];
        if (pending.length === 0) return;
      }
      const ev = pending.shift()!;
      ctx.state.scratch['pending'] = pending;
      const unit = ctx.state.units.find((u) => u.uid === ev.uid);
      if (!unit) return;
      if (ev.kind === 'cast') processCast(ctx, unit);
      else processTurn(ctx, unit);
      checkWipe(ctx);
    },

    isOver(state) {
      return state.over;
    },
  };
}

export { JOBS };
