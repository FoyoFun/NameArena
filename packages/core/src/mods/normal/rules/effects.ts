import type { BattleContext, UnitRuntime } from '../../../engine';
import { STATUS_MAP } from '../data/statuses';

/**
 * 战斗效果基元（无 hook 触发，供能力 hook 与战斗流程复用）。
 * hook 的触发由 combat 层编排，避免能力→效果→能力递归。
 */

export interface DamageOpts {
  /** 反伤/DoT 等内部伤害标记（用于战报文案） */
  source?: string;
  /** 攻击者 uid（DoT 无攻击者时可缺省） */
  attackerUid?: string;
  /** 暴击标记（影响事件 payload 与表现） */
  crit?: boolean;
}

/** 治疗：钳制到 maxHp，发 heal 事件。返回实际治疗量。 */
export function healUnit(ctx: BattleContext, unit: UnitRuntime, rawAmount: number, source?: string): number {
  if (!unit.alive || rawAmount <= 0) return 0;
  const amount = Math.max(1, Math.round(rawAmount));
  const before = unit.stats['hp']!;
  const after = Math.min(unit.stats['maxHp']!, before + amount);
  const healed = after - before;
  unit.stats['hp'] = after;
  if (healed > 0) {
    ctx.emit(
      'heal',
      { uid: unit.uid, amount: healed, hp: after, maxHp: unit.stats['maxHp']!, source: source ?? '' },
      [
        {
          target: `unit:${unit.uid}`,
          durationMs: 600,
          logText: `@${unit.uid}@恢复了 +${healed}+ 点#生命#${source ? `（${source}）` : ''}`,
        },
      ],
    );
  }
  return healed;
}

/**
 * 直接扣血（含护盾吸收），发 damage 事件，致死则走 die()。
 * 不触发任何 hook——hook 编排在 combat 层。
 */
export function damageUnit(
  ctx: BattleContext,
  defender: UnitRuntime,
  rawAmount: number,
  opts: DamageOpts = {},
): void {
  if (!defender.alive || rawAmount <= 0) return;
  let amount = Math.max(1, Math.round(rawAmount));

  // 护盾吸收
  const shield = defender.statuses.find((s) => STATUS_MAP.get(s.id)?.shield);
  let absorbed = 0;
  if (shield) {
    absorbed = Math.min(shield.power, amount);
    shield.power -= absorbed;
    amount -= absorbed;
    if (shield.power <= 0) {
      defender.statuses = defender.statuses.filter((s) => s !== shield);
      ctx.emit('statusRemove', { uid: defender.uid, status: shield.id }, [
        { target: `unit:${defender.uid}`, durationMs: 300, logText: `${defender.name} 的护盾碎裂了` },
      ]);
    }
  }

  if (amount <= 0) {
    ctx.emit('damage', { uid: defender.uid, absorbed, amount: 0, hp: defender.stats['hp']!, maxHp: defender.stats['maxHp']!, source: opts.source ?? '' }, [
      { target: `unit:${defender.uid}`, durationMs: 400, logText: `@${defender.uid}@ 的#护盾#挡下了伤害` },
    ]);
    return;
  }

  defender.stats['hp'] = Math.max(0, defender.stats['hp']! - amount);
  const crit = opts.crit === true;
  ctx.emit(
    'damage',
    { uid: defender.uid, attackerUid: opts.attackerUid, absorbed, amount, crit, hp: defender.stats['hp']!, maxHp: defender.stats['maxHp']!, source: opts.source ?? '' },
    [
      {
        target: `unit:${defender.uid}`,
        vfx: crit ? 'crit-flash' : 'hit',
        durationMs: crit ? 800 : 650,
        logText: `${crit ? '💥 暴击！' : ''}@${defender.uid}@${absorbed > 0 ? `（#护盾#吸收 ${absorbed}）` : ''}受到 ~${amount}~ 点${opts.source ?? ''}#伤害#`,
      },
    ],
  );

  if (defender.stats['hp']! <= 0) die(ctx, defender);
}

/**
 * 死亡处理采用注入式回调（由 ruleset 注册为"触发 onKO hook"），
 * 避免 effects → hooks → abilities → effects 的模块循环。
 */
let deathHandler: ((ctx: BattleContext, unit: UnitRuntime) => void) | null = null;

export function setDeathHandler(fn: (ctx: BattleContext, unit: UnitRuntime) => void): void {
  deathHandler = fn;
}

/** 死亡：标记 + unitDown 事件 + 死亡回调（如不死鸟可在此复活） */
export function die(ctx: BattleContext, unit: UnitRuntime): void {
  if (!unit.alive) return;
  unit.alive = false;
  unit.stats['hp'] = 0;
  ctx.emit('unitDown', { uid: unit.uid, side: unit.side }, [
    { target: `unit:${unit.uid}`, vfx: 'ko', durationMs: 900, logText: `☠️ @${unit.uid}@ 倒下了！` },
  ]);
  deathHandler?.(ctx, unit);
}

/** 施加/刷新状态。战报里增益用 +…+、减益用 ~…~ 标记（客户端渲染为绿/红高亮） */
export function applyStatus(
  ctx: BattleContext,
  unit: UnitRuntime,
  statusId: string,
  duration: number,
  power: number,
): boolean {
  const def = STATUS_MAP.get(statusId);
  if (!def || !unit.alive) return false;
  const colored = def.kind === 'buff' ? `+${def.name}+` : `~${def.name}~`;
  const existing = unit.statuses.find((s) => s.id === statusId);
  if (existing) {
    existing.remain = Math.max(existing.remain, duration);
    existing.power = Math.max(existing.power, power);
    ctx.emit('statusApply', { uid: unit.uid, status: statusId, refreshed: true }, [
      { target: `unit:${unit.uid}`, durationMs: 400, logText: `@${unit.uid}@ 的【${colored}】被刷新了` },
    ]);
    return true;
  }
  unit.statuses.push({ id: statusId, remain: duration, power });
  ctx.emit('statusApply', { uid: unit.uid, status: statusId, refreshed: false }, [
    {
      target: `unit:${unit.uid}`,
      vfx: def.kind === 'buff' ? 'buff' : 'debuff',
      durationMs: 500,
      logText: `@${unit.uid}@ 获得【${colored}】`,
    },
  ]);
  return true;
}
