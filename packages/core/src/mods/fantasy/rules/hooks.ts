import type { BattleContext, UnitRuntime } from '../../../engine';
import type { DamagePayload, FantasyHooks } from '../types';

/**
 * 被动 hook 聚合与触发（meta 驱动，abilities 不被本文件反向依赖）。
 * 同名技能不同来源（职业本体 + 抄本）可叠加，逐一判定（主人裁定）。
 */

export interface HookBag extends FantasyHooks {}

export function hooksOf(unit: UnitRuntime): HookBag {
  return (unit.meta['hooks'] as HookBag | undefined) ?? {};
}

/** 聚合多个被动为单一 hook 袋：数组型语义逐一触发、数值型取累积 */
export function mergeHooks(list: FantasyHooks[]): HookBag {
  const bag: HookBag = {};
  const has = <K extends keyof FantasyHooks>(k: K) => list.some((h) => h[k]);

  if (has('modifyIncomingDamage')) {
    bag.modifyIncomingDamage = (ctx, self, amount, attacker) => {
      let v = amount;
      for (const h of list) v = h.modifyIncomingDamage?.(ctx, self, v, attacker) ?? v;
      return v;
    };
  }
  if (has('onDealtDamage')) {
    bag.onDealtDamage = (ctx, self, p) => {
      for (const h of list) h.onDealtDamage?.(ctx, self, p);
    };
  }
  if (has('onTakenDamage')) {
    bag.onTakenDamage = (ctx, self, p) => {
      for (const h of list) h.onTakenDamage?.(ctx, self, p);
    };
  }
  if (has('onBuffApplied')) {
    bag.onBuffApplied = (ctx, self, target, statusId) => {
      for (const h of list) h.onBuffApplied?.(ctx, self, target, statusId);
    };
  }
  if (has('onHealDone')) {
    bag.onHealDone = (ctx, self, target, amount) => {
      for (const h of list) h.onHealDone?.(ctx, self, target, amount);
    };
  }
  if (has('modifyDamageOut')) {
    bag.modifyDamageOut = (ctx, self, amount) => {
      let v = amount;
      for (const h of list) v = h.modifyDamageOut?.(ctx, self, v) ?? v;
      return v;
    };
  }
  if (has('useInverseTargeting')) {
    bag.useInverseTargeting = (ctx, self) => list.some((h) => h.useInverseTargeting?.(ctx, self) === true);
  }
  if (has('extraActions')) {
    bag.extraActions = (ctx, self) => list.reduce((n, h) => n + (h.extraActions?.(ctx, self) ?? 0), 0);
  }
  if (has('skipCast')) {
    bag.skipCast = (ctx, self) => list.some((h) => h.skipCast?.(ctx, self) === true);
  }
  if (has('reviveChance')) {
    bag.reviveChance = (ctx, self) => list.reduce((m, h) => Math.max(m, h.reviveChance?.(ctx, self) ?? 0), 0);
  }
  return bag;
}

export function fireDealtDamage(ctx: BattleContext, attacker: UnitRuntime, p: DamagePayload): void {
  hooksOf(attacker).onDealtDamage?.(ctx, attacker, p);
}

export function fireTakenDamage(ctx: BattleContext, defender: UnitRuntime, p: DamagePayload): void {
  hooksOf(defender).onTakenDamage?.(ctx, defender, p);
}
