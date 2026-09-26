import { STATUS_MAP } from '../data/statuses';
import type { Character, DerivedKey, SixStats } from '../types';
import type { UnitRuntime } from '../../../engine';

/** 读取单位在状态修正后的有效属性 */
export function effStat(unit: UnitRuntime, key: string): number {
  let v = unit.stats[key] ?? 0;
  let mult = 1;
  for (const s of unit.statuses) {
    const m = STATUS_MAP.get(s.id)?.statMods?.[key as DerivedKey];
    if (m !== undefined) mult *= m;
  }
  return v * mult;
}

export function hasStun(unit: UnitRuntime): boolean {
  return unit.statuses.some((s) => STATUS_MAP.get(s.id)?.control === 'stun');
}

export function charOf(unit: UnitRuntime): Character {
  return unit.char as Character;
}

export function baseOf(unit: UnitRuntime): SixStats {
  return charOf(unit).base;
}
