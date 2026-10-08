import { makeRng, nameSeed } from '../../name-gen';
import { SKILL_POOL } from './abilities';
import { FORMULAS } from './data/formulas';
import { applyJobMods, JOBS } from './data/jobs';
import { rollStat } from './data/stat-distribution';
import { computeDerived } from './data/stat-weights';
import { BASE_STAT_IDS } from './types';
import type { BaseStatId, Character, Gender, SixStats, SkillDef } from './types';

/** 角色生成选项：性别可由玩家指定（对属性零偏置，Q9）；缺省=随机。
 *  F52：职业不再可选——完全由种子随机（群友反馈：想不出朋友是什么职业）。 */
export interface FantasyGenOpts {
  gender?: Gender;
}

/**
 * 角色种子 = hash(name|性别选择, genKey, genVersion)（F52 起）：
 * 只有性别选择参与种子随机——同名不同性别会掷出不同职业与六维；选择本身对属性无任何偏置。
 */
export function fantasySeed(name: string, genKey: string, genVersion: number, opts?: FantasyGenOpts): number {
  return nameSeed(`${name}|${opts?.gender ?? ''}`, genKey, genVersion);
}

function resolveSelections(opts: FantasyGenOpts | undefined, rng: import('../../name-gen').Rng): { gender: Gender; jobId: string } {
  const gender = opts?.gender;
  if (gender !== undefined && gender !== 'male' && gender !== 'female') {
    throw new Error(`未知性别：${String(gender)}`);
  }
  return {
    gender: gender ?? (rng.chance(0.5) ? 'male' : 'female'),
    jobId: rng.weighted(JOBS.map((j) => ({ item: j, weight: 1 }))).id,
  };
}

/**
 * 角色生成管线（F52 起的确定性链）：
 * 种子（名字+性别选择）→ 性别 → 职业（随机）→ 六维 → 派生（映射+职业补正）→ 技能池抽取。
 * 职业不影响六维分布、性别无偏置（Q9）；职业补正在派生时叠加。
 */
export function generateFantasyCharacter(name: string, genKey: string, genVersion: number, opts?: FantasyGenOpts): Character {
  const rng = makeRng(fantasySeed(name, genKey, genVersion, opts));
  const { gender, jobId } = resolveSelections(opts, rng);
  const job = JOBS.find((j) => j.id === jobId)!;

  // 六维（分层数据表：10~89 均匀，尾部沿用 normal 档位）
  const base = {} as SixStats;
  const tiers = {} as Record<BaseStatId, string>;
  for (const s of BASE_STAT_IDS) {
    const r = rollStat(rng);
    base[s] = r.value;
    tiers[s] = r.tier.id;
  }

  // 派生：连续映射 + 职业补正（补正只在计算战斗属性时按职业给）
  const derived = applyJobMods(computeDerived(base), job);

  // 技能池：第一个必得 + 伪预算循环（P_stop = 1 − e^(−cost/λ)，永不到 100%）
  const picked: SkillDef[] = [];
  const pickedIds = new Set<string>();
  const add = (a: SkillDef): boolean => {
    if (pickedIds.has(a.id)) return false;
    picked.push(a);
    pickedIds.add(a.id);
    return true;
  };
  if (SKILL_POOL.length > 0) {
    add(rng.weighted(SKILL_POOL.map((a) => ({ item: a, weight: a.weight }))));
  }
  let cost = picked.reduce((s, a) => s + a.cost, 0);
  for (;;) {
    const pStop = 1 - Math.exp(-cost / FORMULAS.stopLambda);
    if (rng.chance(pStop)) break;
    const remaining = SKILL_POOL.filter((a) => !pickedIds.has(a.id));
    if (remaining.length === 0) break;
    const a = rng.weighted(remaining.map((x) => ({ item: x, weight: x.weight })));
    if (!add(a)) continue;
    cost += a.cost;
  }

  return {
    name,
    genVersion,
    gender,
    jobId: job.id,
    base,
    tiers,
    derived,
    skills: [
      { id: job.passiveId, source: 'job' as const },
      { id: job.activeId, source: 'job' as const },
      ...picked.map((a) => ({ id: a.id, source: 'pool' as const })),
    ],
    totalCost: cost,
  };
}
