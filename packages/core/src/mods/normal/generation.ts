import { makeRng, nameSeed } from '../../name-gen';
import { ABILITY_LIST, BASIC_ATTACK_ID } from './abilities';
import { matchConditional } from './data/conditional-rules';
import { FORMULAS } from './data/formulas';
import { PERSONALITIES, assertPersonalitySafe } from './data/personalities';
import { rollStat } from './data/stat-distribution';
import { computeDerived } from './data/stat-weights';
import { STAT_IDS } from './types';
import type { AbilityDef, Character, CharacterAbility, SixStats, StatId } from './types';

assertPersonalitySafe();

/** 基础标配：人人免费自带（不进抽取池、不计伪预算 cost）。
 *  火球术人人有份——法术高的名字至少保底一个法术主动技（DESIGN.md #41）。 */
const BASE_KIT_IDS = [BASIC_ATTACK_ID, 'fireball'];

/**
 * 角色生成管线（DESIGN.md 7.3，顺序即设计）：
 * 1. 掷六维（分层数据表）→ 2. 挂条件能力（免费不占 cost）→ 3. 保底基础标配 + 第一个随机能力必得
 * → 4. 循环抽取：P_stop = 1 − e^(−cost/λ)，永不到 100% → 5. 性格。
 * 全程只用 nameSeed 派生的 Rng：同名同生成域同版本必得同角色。
 */
export function generateNormalCharacter(name: string, genKey: string, genVersion: number): Character {
  const rng = makeRng(nameSeed(name, genKey, genVersion));

  // 1. 掷六维
  const base = {} as SixStats;
  const tiers = {} as Record<StatId, string>;
  for (const s of STAT_IDS) {
    const r = rollStat(rng);
    base[s] = r.value;
    tiers[s] = r.tier.id;
  }

  // 2. 条件能力（档位 + 图案）
  const conditionalIds = matchConditional(base);

  // 3. 随机能力池（基础标配与条件能力不在池中）
  const pool = ABILITY_LIST.filter(
    (a) => !BASE_KIT_IDS.includes(a.id) && a.weight > 0 && !conditionalIds.includes(a.id),
  );
  const picked: AbilityDef[] = [];
  const pickedIds = new Set<string>();
  const add = (a: AbilityDef): boolean => {
    if (pickedIds.has(a.id)) return false;
    picked.push(a);
    pickedIds.add(a.id);
    return true;
  };
  // 第一个随机能力必得（没有废角色的保底）
  if (pool.length > 0) {
    add(rng.weighted(pool.map((a) => ({ item: a, weight: a.weight }))));
  }

  // 4. 伪预算循环：cost 越高越可能收手，但永远不到 100%
  let cost = picked.reduce((s, a) => s + a.cost, 0);
  for (;;) {
    const pStop = 1 - Math.exp(-cost / FORMULAS.stopLambda);
    if (rng.chance(pStop)) break;
    const remaining = pool.filter((a) => !pickedIds.has(a.id));
    if (remaining.length === 0) break;
    const a = rng.weighted(remaining.map((x) => ({ item: x, weight: x.weight })));
    if (!add(a)) continue;
    cost += a.cost;
  }

  // 5. 性格（只调倾向，永不废人，见 data/personalities.ts 铁律）
  const personality = rng.pick(PERSONALITIES);

  const abilities: CharacterAbility[] = [
    ...BASE_KIT_IDS.map((id) => ({ id, source: 'basic' as const })),
    ...conditionalIds.map((id) => ({ id, source: 'conditional' as const })),
    ...picked.map((a) => ({ id: a.id, source: 'random' as const })),
  ];

  return {
    name,
    genVersion,
    base,
    tiers,
    derived: computeDerived(base),
    abilities,
    totalCost: cost,
    personalityId: personality.id,
  };
}
