import type { Mod, ModDisplay, StatMeta, TeamConfig, UnitConfig } from '../../engine';
import { validateName } from '../../name-gen';
import { fantasySeed, generateFantasyCharacter } from './generation';
import type { FantasyGenOpts } from './generation';
import { fantasyRuleset } from './rules/ruleset';
import { getSkill } from './abilities';
import { STATUS_MAP } from './data/statuses';
import { STAT_TIERS } from './data/stat-distribution';
import { FORMULAS } from './data/formulas';
import { FANTASY_BOSSES, FANTASY_BOSS_MAP, bossCharacter } from './data/bosses';
import type { BaseStatId, Character, Gender, JobId } from './types';
import { JOB_MAP } from './data/jobs';

export { generateFantasyCharacter, fantasySeed } from './generation';
export { STATUSES, STATUS_MAP, RANDOM_BUFF_POOL, RANDOM_DEBUFF_POOL } from './data/statuses';
export { JOBS, JOB_MAP, applyJobMods } from './data/jobs';
export { STAT_TIERS } from './data/stat-distribution';
export { computeDerived, wHigh, wLow, STAT_MAPPING } from './data/stat-weights';
export { FORMULAS } from './data/formulas';
export { SKILL_LIST, SKILL_MAP, SKILL_POOL, getSkill } from './abilities';
export { PETS } from './data/pets';
export { FANTASY_BOSSES, FANTASY_BOSS_MAP, bossCharacter } from './data/bosses';
export { unitSnapshot } from './rules/setup';

/** 生成域与版本：幻想大乱斗 PVP/PVE 共用，同名同选必同角色（DESIGN-FANTASY.md §0） */
export const FANTASY_GEN_KEY = 'fantasy';
/** v3：性别/职业选择参与种子（F42）。改变"名字→角色"映射的修改必须递增版本号 */
export const FANTASY_GEN_VERSION = 3;

/** UnitCard 展示哪些数值——F47：玩家只看基础属性，战斗属性全部隐藏（HP 条除外，观战必需） */
export const FANTASY_STATS: StatMeta[] = [
  { id: 'hp', label: '生命', show: 'bar', barMaxStat: 'maxHp', color: '#f87171' },
  { id: 'atk', label: '攻击', show: 'hidden' },
  { id: 'def', label: '防御', show: 'hidden' },
  { id: 'spd', label: '速度', show: 'hidden', desc: '行动与咏唱速率' },
  { id: 'crit', label: '暴击', show: 'hidden', desc: '暴击固定×1.6' },
  { id: 'hit', label: '命中', show: 'hidden' },
  { id: 'dodge', label: '闪避', show: 'hidden' },
  { id: 'resist', label: '抵抗', show: 'hidden', desc: '摆脱异常状态的概率' },
  { id: 'absorb', label: '吸收', show: 'hidden', desc: '保持增益状态的概率' },
  { id: 'destiny', label: '天选', show: 'hidden', desc: '提升一切有利判定的概率' },
  { id: 'ailment', label: '异常', show: 'hidden', desc: '施加异常状态的概率补正' },
];

/** 展示适配（ModDisplay）：fantasy 的六维/技能/职业性别 翻译成通用 UI 形态 */
const FANTASY_DISPLAY: ModDisplay = {
  sixStats: [
    { key: 'str', label: '力量', short: '力' },
    { key: 'vit', label: '体质', short: '体' },
    { key: 'int', label: '智力', short: '智' },
    { key: 'spr', label: '精神', short: '神' },
    { key: 'agi', label: '敏捷', short: '敏' },
    { key: 'luk', label: '幸运', short: '运' },
  ],
  tierLabel: (id) => STAT_TIERS.find((x) => x.id === id)?.label ?? '',
  derivedRows() {
    // F47：战斗属性对玩家隐藏（只展示基础六维）
    return [];
  },
  skills(char) {
    // F47：只显示职业技能（被动+主动），随机池技能对玩家隐藏
    return (char as Character).skills
      .filter((s) => s.source === 'job')
      .map((s) => {
        const def = getSkill(s.id);
        return { id: s.id, name: def?.name ?? s.id, desc: def?.desc ?? '', kind: def?.kind ?? 'passive', cost: def?.cost ?? 0 };
      });
  },
  tags(char) {
    const c = char as Character;
    const job = JOB_MAP.get(c.jobId);
    return [job ? job.name : '', c.gender === 'male' ? '♂男' : '♀女'].filter(Boolean);
  },
  statusBrief: (id) => {
    const s = STATUS_MAP.get(id);
    return s ? { name: s.name, kind: s.kind } : undefined;
  },
  roundLabel: '行动',
};

function validateMembers(units: UnitConfig[], max: number, sideLabel: string): string | null {
  if (units.length === 0) return `${sideLabel}至少需要 1 名队员`;
  if (units.length > max) return `${sideLabel}最多 ${max} 人`;
  for (const u of units) {
    const r = validateName(u.name);
    if (!r.ok) return `队员名不合法：${r.reason}`;
  }
  return null;
}

export function buildFantasyMod(kind: 'pvp' | 'pve'): Mod {
  return {
    id: `fantasy-${kind}`,
    name: kind === 'pvp' ? '幻想大乱斗PVP' : '幻想大乱斗PVE',
    genKey: FANTASY_GEN_KEY,
    genVersion: FANTASY_GEN_VERSION,
    stats: FANTASY_STATS,
    display: FANTASY_DISPLAY,
    generateCharacter: (_rng, opts) =>
      generateFantasyCharacter(opts.name, FANTASY_GEN_KEY, FANTASY_GEN_VERSION, opts.opts as FantasyGenOpts | undefined),
    rules: fantasyRuleset(kind, FANTASY_GEN_KEY, FANTASY_GEN_VERSION),
    /** 建队校验：性别/职业选择的合法性（拒绝制） */
    validateGenOpts(opts) {
      if (!opts) return null;
      const g = opts['gender'] as Gender | undefined;
      if (g !== undefined && g !== 'male' && g !== 'female') return `未知性别：${String(g)}`;
      const j = opts['jobId'] as JobId | undefined;
      if (j !== undefined && !JOB_MAP.has(j)) return `未知职业：${String(j)}`;
      return null;
    },
    team:
      kind === 'pvp'
        ? {
            maxUnits: 5,
            validateTeam(team: TeamConfig): string | null {
              return validateMembers(team.units, 5, `${team.side} 方`);
            },
            validateTeams(teams: TeamConfig[]): string | null {
              if (teams.length !== 2) return '幻想大乱斗PVP 需要两支队伍';
              for (const t of teams) {
                const err = validateMembers(t.units, 5, `${t.side} 方`);
                if (err) return err;
              }
              return null; // 人数不齐允许（多打少，不补人）
            },
          }
        : {
            maxUnits: 8,
            validateTeam(team: TeamConfig): string | null {
              return validateMembers(team.units, 8, `${team.side} 方`);
            },
            validateTeams(teams: TeamConfig[]): string | null {
              if (teams.length !== 2) return '幻想大乱斗PVE 需要两支队伍';
              for (const t of teams) {
                const err = validateMembers(t.units, 8, `${t.side} 方`);
                if (err) return err;
              }
              return null;
            },
          },
    // PVE：Boss 由数据文件重建（多单位编队支持）；PVP 实例不提供
    pveEnemies:
      kind === 'pve'
        ? (bossId) => {
            const def = FANTASY_BOSS_MAP.get(bossId) ?? FANTASY_BOSSES[0]!;
            return def.units.map((u) => ({ name: u.name, side: 'B', char: bossCharacter(u) }));
          }
        : undefined,
    pveBosses:
      kind === 'pve'
        ? () => FANTASY_BOSSES.map((b) => ({ id: b.id, name: b.name, title: b.title, desc: b.desc }))
        : undefined,
  };
}

export const FANTASY_PVP = buildFantasyMod('pvp');
export const FANTASY_PVE = buildFantasyMod('pve');
