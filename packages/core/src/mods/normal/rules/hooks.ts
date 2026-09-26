import type { BattleContext, UnitRuntime } from '../../../engine';
import type { Character, DamagePayload, HookName, NormalHooks, SkillCostPlan } from '../types';
import { getAbility } from '../abilities';

/**
 * hook 聚合与触发。单位身上的所有能力 hook 在开战时聚合到 meta.hooks。
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyFn = (...args: any[]) => any;
type HookFnMap = Partial<Record<HookName, AnyFn[]>>;

export function aggregateHooks(unit: UnitRuntime, char: Character): void {
  const map: HookFnMap = {};
  for (const ca of char.abilities) {
    const def = getAbility(ca.id);
    if (!def?.hooks) continue;
    for (const [name, fn] of Object.entries(def.hooks) as [HookName, AnyFn][]) {
      const list = (map[name] ??= []);
      list.push(fn);
    }
  }
  unit.meta['hooks'] = map;
}

function fns(unit: UnitRuntime, name: HookName): AnyFn[] {
  return (unit.meta['hooks'] as HookFnMap | undefined)?.[name] ?? [];
}

export function applyModifyActionCount(ctx: BattleContext, unit: UnitRuntime): number {
  let extra = 0;
  for (const fn of fns(unit, 'modifyActionCount')) extra += fn(ctx, unit) as number;
  return extra;
}

export function applyModifySkillCost(ctx: BattleContext, unit: UnitRuntime, plan: SkillCostPlan): SkillCostPlan {
  let cur = plan;
  for (const fn of fns(unit, 'modifySkillCost')) cur = fn(ctx, unit, cur) as SkillCostPlan;
  return cur;
}

/** 管道式修正：先攻方 hook，后守方 hook（由 combat 依次调用） */
export function applyModifyDamageCalc(ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload {
  let cur = p;
  for (const fn of fns(unit, 'modifyDamageCalc')) cur = fn(ctx, unit, cur) as DamagePayload;
  return cur;
}

export function fireOnDealDamage(ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): void {
  for (const fn of fns(unit, 'onDealDamage')) fn(ctx, unit, p);
}

export function fireOnTakeDamage(ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): void {
  for (const fn of fns(unit, 'onTakeDamage')) fn(ctx, unit, p);
}

export function fireOnDodge(ctx: BattleContext, unit: UnitRuntime, p: { attacker: UnitRuntime; defender: UnitRuntime }): void {
  for (const fn of fns(unit, 'onDodge')) fn(ctx, unit, p);
}

export function fireOnKO(ctx: BattleContext, unit: UnitRuntime): void {
  for (const fn of fns(unit, 'onKO')) fn(ctx, unit);
}

export function applyModifyTargeting(
  ctx: BattleContext,
  unit: UnitRuntime,
  candidates: UnitRuntime[],
): UnitRuntime[] {
  let cur = candidates;
  for (const fn of fns(unit, 'modifyTargeting')) cur = fn(ctx, unit, cur) as UnitRuntime[];
  return cur;
}
