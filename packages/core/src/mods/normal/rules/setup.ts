import type { UnitRuntime } from '../../../engine';
import { getAbility, BASIC_ATTACK_ID } from '../abilities';
import { PERSONALITY_MAP } from '../data/personalities';
import { FORMULAS } from '../data/formulas';
import { computeDerived } from '../data/stat-weights';
import { aggregateHooks } from './hooks';
import type { BossDef, Character, CharacterAbility, DerivedKey, DerivedStats } from '../types';

/** 应用全部被动属性修正（含条件能力的被动项），并施加暴击上限 */
export function applyPassiveMods(derived: DerivedStats, abilities: CharacterAbility[]): DerivedStats {
  const out = { ...derived };
  for (const ca of abilities) {
    const mods = getAbility(ca.id)?.passiveStatMods;
    if (!mods) continue;
    for (const [k, m] of Object.entries(mods) as [DerivedKey, number][]) {
      out[k] = out[k]! * m;
    }
  }
  out.crit = Math.min(out.crit, FORMULAS.critCap);
  return out;
}

/** 开战初始化：派生 → 被动修正 → 单位 stats 快照 */
export function initUnitStats(unit: UnitRuntime, char: Character): void {
  const d = applyPassiveMods(char.derived, char.abilities);
  unit.stats = {
    hp: Math.round(d.maxHp),
    maxHp: Math.round(d.maxHp),
    mp: Math.round(d.maxMp),
    maxMp: Math.round(d.maxMp),
    atk: Math.round(d.atk),
    mag: Math.round(d.mag),
    pdef: Math.round(d.pdef),
    mdef: Math.round(d.mdef),
    dodge: Math.round(d.dodge * 1000) / 1000,
    crit: Math.round(d.crit * 1000) / 1000,
    critDmg: Math.round(d.critDmg * 100) / 100,
    spd: Math.round(d.spd * 10) / 10,
  };
  aggregateHooks(unit, char);
  unit.meta['cd'] = {};
}

/** Boss 定义 → Character（不走名字生成） */
export function bossCharacter(def: BossDef): Character {
  const abilities: CharacterAbility[] = def.abilityIds.map((id) => ({
    id,
    source: id === BASIC_ATTACK_ID ? ('basic' as const) : ('preset' as const),
  }));
  return {
    name: def.name,
    genVersion: 0,
    base: { ...def.base },
    tiers: {} as Record<string, string>,
    derived: computeDerived(def.base),
    abilities,
    totalCost: 0,
    personalityId: def.personalityId,
  };
}

/** battleStart 事件的单位快照：客户端 UnitCard 的全部数据来源 */
export function unitSnapshot(unit: UnitRuntime) {
  const char = unit.char as Character;
  const p = PERSONALITY_MAP.get(char.personalityId);
  const abilities = char.abilities.map((ca) => {
    const def = getAbility(ca.id);
    return {
      id: ca.id,
      name: def?.name ?? ca.id,
      desc: def?.desc ?? '',
      kind: def?.kind ?? 'passive',
      source: ca.source,
      cost: def?.cost ?? 0,
    };
  });
  return {
    uid: unit.uid,
    side: unit.side,
    name: unit.name,
    owner: (unit.meta['owner'] as string | undefined) ?? '',
    personalityId: char.personalityId,
    personalityName: p ? `${p.emoji}${p.name}` : char.personalityId,
    personalityDesc: p?.desc ?? '',
    tags: [p ? `${p.emoji}${p.name}` : ''].filter(Boolean),
    stats: { ...unit.stats },
    base: { ...char.base },
    tiers: { ...char.tiers },
    // skills 为通用字段名（ModDisplay 契约）；abilities 保留兼容旧消费点
    skills: abilities,
    abilities,
    totalCost: char.totalCost,
  };
}
