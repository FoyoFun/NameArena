import type { BattleContext, UnitRuntime } from '../../../engine';
import { STATUS_MAP } from '../data/statuses';
import type { FStatusDef } from '../data/statuses';

/**
 * 战斗效果基元（不触发 hook；hook 编排在 combat 层，避免递归）。
 * 同 normal 的分层纪律：effects ← abilities(hook 实现) ← combat(hook 编排)。
 */

export interface FStatusInst {
  /** 战斗内唯一实例 id */
  iid: number;
  id: string;
  sourceUid: string;
  /** flat DoT 每跳值；pctCurrent 型存比例 */
  power: number;
  /** 已存在的自身回合数（难度曲线用） */
  elapsed: number;
  /** 新挂保护：保到下个回合结束，首次不 roll（F5） */
  grace: boolean;
  /** fixed 型剩余回合 */
  remain: number;
}

export function fsOf(unit: UnitRuntime): FStatusInst[] {
  let fs = unit.meta['fs'] as FStatusInst[] | undefined;
  if (!fs) {
    fs = [];
    unit.meta['fs'] = fs;
  }
  return fs;
}

function nextIid(ctx: BattleContext): number {
  const s = ctx.state.scratch;
  s['iidSeq'] = ((s['iidSeq'] as number | undefined) ?? 0) + 1;
  return s['iidSeq'] as number;
}

export interface ApplyStatusOpts {
  sourceUid?: string;
  /** flat DoT 强度 */
  power?: number;
  /** pctCurrent 型比例（流血） */
  pct?: number;
  /** fixed 型覆盖时长 */
  fixedTurns?: number;
}

/** 施加状态：同 id 多实例并存（不同来源独立结算）。控制类挂到吟唱中单位会立即打断吟唱（F4）。 */
export function applyStatusInstance(ctx: BattleContext, target: UnitRuntime, statusId: string, opts: ApplyStatusOpts = {}): boolean {
  const def = STATUS_MAP.get(statusId);
  if (!def || !target.alive) return false;
  const inst: FStatusInst = {
    iid: nextIid(ctx),
    id: statusId,
    sourceUid: opts.sourceUid ?? '',
    power: opts.pct ?? opts.power ?? 0,
    elapsed: 0,
    grace: def.durationType !== 'fixed',
    remain: opts.fixedTurns ?? def.defaultDuration,
  };
  fsOf(target).push(inst);
  const colored = def.kind === 'buff' ? `+${def.name}+` : `~${def.name}~`;
  ctx.emit('statusApply', { uid: target.uid, status: statusId, iid: inst.iid, kind: def.kind }, [
    {
      target: `unit:${target.uid}`,
      vfx: def.kind === 'buff' ? 'buff' : 'debuff',
      durationMs: 450,
      logText: `@${target.uid}@ 获得【${colored}】`,
    },
  ]);

  // 控制类打断吟唱：技能作废、ATB 归 0（Q4-3 裁定）
  if (def.control && target.meta['casting']) {
    target.meta['casting'] = null;
    target.meta['atb'] = 0;
    ctx.emit('log', { uid: target.uid, type: 'interrupt' }, [
      { target: `unit:${target.uid}`, vfx: 'stun', durationMs: 700, logText: `💥 @${target.uid}@ 的咏唱被【~${def.name}~】打断了！` },
    ]);
  }
  return true;
}

export function removeStatusInst(ctx: BattleContext, unit: UnitRuntime, inst: FStatusInst, reason: 'resist' | 'absorb' | 'expire' | 'consume'): void {
  const fs = fsOf(unit);
  const idx = fs.indexOf(inst);
  if (idx >= 0) fs.splice(idx, 1);
  const def = STATUS_MAP.get(inst.id);
  if (reason === 'resist' || reason === 'absorb') {
    // 高频小事件：短文案，前端可用静默开关过滤（F17，payload.type 供过滤）
    ctx.emit('log', { uid: unit.uid, type: reason, status: inst.id }, [
      { target: `unit:${unit.uid}`, durationMs: 200, logText: `@${unit.uid}@ ${reason === 'resist' ? '摆脱了' : '未能保持'}【${def?.kind === 'buff' ? `+${def?.name}+` : `~${def?.name}~`}】` },
    ]);
  } else if (reason === 'expire') {
    ctx.emit('statusRemove', { uid: unit.uid, status: inst.id }, [
      { target: `unit:${unit.uid}`, durationMs: 250, logText: `@${unit.uid}@ 的【${def?.name ?? inst.id}】效果结束了` },
    ]);
  }
}

/** 治疗基元：钳制 maxHp，发 heal 事件，返回实际治疗量 */
export function healUnit(ctx: BattleContext, unit: UnitRuntime, rawAmount: number, source?: string): number {
  if (!unit.alive || rawAmount <= 0) return 0;
  const amount = Math.max(1, Math.round(rawAmount));
  const before = unit.stats['hp']!;
  const after = Math.min(unit.stats['maxHp']!, before + amount);
  const healed = after - before;
  unit.stats['hp'] = after;
  if (healed > 0) {
    ctx.emit('heal', { uid: unit.uid, amount: healed, hp: after, maxHp: unit.stats['maxHp']!, source: source ?? '' }, [
      { target: `unit:${unit.uid}`, vfx: 'heal', durationMs: 600, logText: `@${unit.uid}@ 恢复了 +${healed}+ 点#生命#${source ? `（${source}）` : ''}` },
    ]);
  }
  return healed;
}

export interface DamageOpts {
  attackerUid?: string;
  crit?: boolean;
  source?: string;
}

/** 直接扣血基元（易伤等乘区由 calcDamage 算好再进来），致死走 die() */
export function damageUnit(ctx: BattleContext, defender: UnitRuntime, rawAmount: number, opts: DamageOpts = {}): void {
  if (!defender.alive || rawAmount <= 0) return;
  const amount = Math.max(1, Math.round(rawAmount));
  defender.stats['hp'] = Math.max(0, defender.stats['hp']! - amount);
  const crit = opts.crit === true;
  ctx.emit('damage', { uid: defender.uid, attackerUid: opts.attackerUid, amount, crit, hp: defender.stats['hp']!, maxHp: defender.stats['maxHp']!, source: opts.source ?? '' }, [
    {
      target: `unit:${defender.uid}`,
      vfx: crit ? 'crit-flash' : 'hit',
      durationMs: crit ? 800 : 650,
      logText: `${crit ? '💥 暴击！' : ''}@${defender.uid}@ 受到 ~${amount}~ 点${opts.source ?? ''}#伤害#`,
    },
  ]);
  if (defender.stats['hp']! <= 0) die(ctx, defender);
}

/** 死亡：标记 + unitDown 事件 + 停止吟唱。复活 roll 在该单位下次 ATB 满（阶段8）进行 */
export function die(ctx: BattleContext, unit: UnitRuntime): void {
  if (!unit.alive) return;
  unit.alive = false;
  unit.stats['hp'] = 0;
  unit.meta['casting'] = null;
  ctx.emit('unitDown', { uid: unit.uid, side: unit.side }, [
    { target: `unit:${unit.uid}`, vfx: 'ko', durationMs: 900, logText: `☠️ @${unit.uid}@ 倒下了！` },
  ]);
}

export function isControl(def: FStatusDef | undefined): boolean {
  return def?.control === true;
}
