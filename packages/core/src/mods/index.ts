import type { Mod } from '../engine';
import { FANTASY_PVE, FANTASY_PVP } from './fantasy/mod';

/**
 * 注册模组清单（F47：常规模式退场——主人裁定 2026-10-07，只保留幻想大乱斗）。
 * normal 模组代码保留在 mods/normal/ 作为框架参照实现与测试基线，不再注册。
 */
export const MODS: Mod[] = [FANTASY_PVP, FANTASY_PVE];

export function getMod(id: string): Mod {
  const mod = MODS.find((m) => m.id === id);
  if (!mod) throw new Error(`未知模组：${id}`);
  return mod;
}

// 常规模组（已退场）仍导出：测试与历史战报重演可用
export * from './normal/mod';
// 幻想大乱斗：与 normal 重名的导出加 FANTASY_ 前缀（STATUS_MAP/STATUSES/STAT_TIERS/FORMULAS）
export {
  FANTASY_PVP,
  FANTASY_PVE,
  buildFantasyMod,
  FANTASY_GEN_KEY,
  FANTASY_GEN_VERSION,
  FANTASY_STATS,
  fantasySeed,
  generateFantasyCharacter,
  JOBS,
  JOB_MAP,
  SKILL_LIST,
  SKILL_MAP,
  SKILL_POOL,
  getSkill,
  PETS,
  FANTASY_BOSSES,
  FANTASY_BOSS_MAP,
  bossCharacter as fantasyBossCharacter,
  RANDOM_BUFF_POOL,
  RANDOM_DEBUFF_POOL,
  unitSnapshot as fantasyUnitSnapshot,
  applyJobMods as fantasyApplyJobMods,
  computeDerived as fantasyComputeDerived,
  STATUSES as FANTASY_STATUSES,
  STATUS_MAP as FANTASY_STATUS_MAP,
  STAT_TIERS as FANTASY_STAT_TIERS,
  FORMULAS as FANTASY_FORMULAS,
} from './fantasy/mod';
