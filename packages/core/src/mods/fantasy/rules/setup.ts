import { makeUnit } from '../../../engine';
import type { BattleContext, UnitRuntime } from '../../../engine';
import { getSkill } from '../abilities';
import { JOBS, JOB_MAP } from '../data/jobs';
import { FORMULAS } from '../data/formulas';
import { PETS } from '../data/pets';
import { mergeHooks } from './hooks';
import type { Character, CombatKey, FantasyHooks, PetDef } from '../types';

/** 单位初始化与召唤（ruleset 调用）。 */

export function charOf(unit: UnitRuntime): Character {
  return unit.char as Character;
}

export function weightOf(unit: UnitRuntime): number {
  return (unit.meta['weight'] as number | undefined) ?? 1;
}

function round4(v: number): number {
  return Math.round(v * 10000) / 10000;
}

/** 基础面钳制（与 effStat 同规则、无状态修正）——快照/卡面显示与战斗取值一致 */
function clampStat(key: string, v: number): number {
  const c = (FORMULAS.clamp as Record<string, { min: number; max: number } | undefined>)[key];
  return c ? Math.min(c.max, Math.max(c.min, v)) : v;
}

/** 开战初始化：派生快照 + ATB 随机起点 + 被动 hook 聚合（确定性：随机只走 ctx.rng）。
 *  攻/防/速存整数（主人裁定 F45：属性不显示小数）；百分比属性存 4 位小数、显示层 ×100。 */
export function initUnit(ctx: BattleContext, unit: UnitRuntime, char: Character, hate: number): void {
  const d = char.derived;
  unit.stats = {
    hp: Math.round(d.maxHp),
    maxHp: Math.round(d.maxHp),
    atk: Math.round(d.atk),
    def: Math.round(d.def),
    spd: Math.round(clampStat('spd', d.spd)),
    crit: round4(clampStat('crit', d.crit)),
    hit: round4(clampStat('hit', d.hit)),
    dodge: round4(clampStat('dodge', d.dodge)),
    resist: round4(clampStat('resist', d.resist)),
    absorb: round4(clampStat('absorb', d.absorb)),
    destiny: Math.round(d.destiny),
    ailment: round4(clampStat('ailment', d.ailment)),
    hate: round4(hate),
  };
  unit.meta['atb'] = ctx.rng.int(0, FORMULAS.atbStartMax);
  unit.meta['combo'] = 0;
  unit.meta['casting'] = null;
  unit.meta['weight'] = 1;
  unit.meta['lastHarmTick'] = 0;
  unit.meta['hooks'] = aggregateCharHooks(char);
}

export function aggregateCharHooks(char: Character): FantasyHooks {
  const list: FantasyHooks[] = [];
  for (const cs of char.skills) {
    const def = getSkill(cs.id);
    if (def?.kind === 'passive' && def.passive) list.push(def.passive);
  }
  return mergeHooks(list);
}

// ---------- 召唤 ----------

/** 宠物单位的最小角色载体（满足 ai.charOf 的 {name, skills} 契约） */
export interface PetCharacter {
  name: string;
  petDef: PetDef;
  ownerName: string;
  skills: { id: string; source: 'job' }[];
}

function petStats(summoner: UnitRuntime, pet: PetDef): Record<string, number> {
  const s = summoner.stats;
  const atk = Math.round((s['atk'] ?? 100) * (pet.derive.atk ?? 1));
  const def = Math.round((s['def'] ?? 100) * (pet.derive.def ?? 1));
  const spd = Math.round((s['spd'] ?? 100) * (pet.derive.spd ?? 1));
  const maxHp = Math.round((s['maxHp'] ?? 900) * (pet.derive.maxHp ?? 1));
  const fixed = pet.fixed as Partial<Record<CombatKey, number>>;
  const f = (k: CombatKey, dflt: number) => round4(fixed[k] ?? dflt);
  return {
    hp: maxHp,
    maxHp,
    atk,
    def,
    spd,
    crit: f('crit', 0.05),
    hit: f('hit', 0.5),
    dodge: f('dodge', 0.1),
    resist: f('resist', 0.25),
    absorb: f('absorb', 0.25),
    destiny: Math.round(fixed.destiny ?? 0),
    ailment: f('ailment', 0),
    hate: round4(pet.hate / 1000),
  };
}

/** 召唤（§5.7）：不占队伍人数、不计分、受 24 上限；满员时技能照放但召唤失败（F15） */
export function summonPet(ctx: BattleContext, summoner: UnitRuntime, petId: string): void {
  const pet = PETS[petId];
  if (!pet) return;
  if (ctx.state.units.length >= FORMULAS.maxUnitsOnField) {
    ctx.emit('log', { uid: summoner.uid, type: 'summonFail' }, [
      { target: `unit:${summoner.uid}`, durationMs: 400, logText: `🐾 场上已满员，@${summoner.uid}@ 的召唤失败了` },
    ]);
    return;
  }
  const seq = (ctx.state.scratch['petSeq'] as number | undefined) ?? 0;
  ctx.state.scratch['petSeq'] = seq + 1;
  const uid = `${summoner.side}-S${seq + 1}`;
  const petName = seq + 1 > 1 ? `${pet.name}${seq + 1}` : pet.name;
  const char: PetCharacter = {
    name: petName,
    petDef: pet,
    ownerName: summoner.name,
    skills: pet.skills.map((id) => ({ id, source: 'job' as const })),
  };
  const unit = makeUnit(uid, summoner.side, char.name, char);
  unit.stats = petStats(summoner, pet);
  unit.meta['atb'] = 0;
  unit.meta['combo'] = 0;
  unit.meta['casting'] = null;
  unit.meta['weight'] = FORMULAS.summonWeight;
  unit.meta['lastHarmTick'] = 0;
  unit.meta['pet'] = true;
  unit.meta['summonerUid'] = summoner.uid;
  unit.meta['hooks'] = aggregateCharHooks(char as unknown as Character);
  ctx.state.units.push(unit);
  ctx.emit('log', { uid, type: 'summon', unit: unitSnapshot(unit) }, [
    { target: `unit:${uid}`, vfx: 'buff', durationMs: 700, logText: `🐾 @${summoner.uid}@ 召唤出了 ${pet.name}！` },
  ]);
}

// ---------- 快照 ----------

/** battleStart / summon 事件的单位快照：客户端 UnitCard 的数据来源 */
export function unitSnapshot(unit: UnitRuntime) {
  const char = unit.char as Character;
  const job = JOB_MAP.get(char.jobId);
  return {
    uid: unit.uid,
    side: unit.side,
    name: unit.name,
    owner: (unit.meta['owner'] as string | undefined) ?? '',
    stats: { ...unit.stats },
    base: char.base ?? {},
    tiers: char.tiers ?? {},
    gender: char.gender,
    genderLabel: char.gender === 'male' ? '♂' : char.gender === 'female' ? '♀' : '',
    jobId: char.jobId ?? '',
    jobName: job?.name ?? (unit.meta['pet'] ? '召唤物' : ''),
    pet: unit.meta['pet'] === true,
    tags: [
      job?.name ?? (unit.meta['pet'] ? '召唤物' : ''),
      char.gender === 'male' ? '♂男' : char.gender === 'female' ? '♀女' : '',
    ].filter(Boolean),
    skills: (char.skills ?? [])
      .filter((cs) => cs.source === 'job') // F47：战斗卡只展示职业技能
      .map((cs) => {
        const def = getSkill(cs.id);
        return { id: cs.id, name: def?.name ?? cs.id, desc: def?.desc ?? '', kind: def?.kind ?? 'passive', label: def?.label, source: cs.source };
      }),
    totalCost: char.totalCost ?? 0,
  };
}

export { JOBS };
