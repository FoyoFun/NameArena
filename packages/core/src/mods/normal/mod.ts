import type { Mod, StatMeta, TeamConfig, UnitConfig } from '../../engine';
import { validateName } from '../../name-gen';
import { BOSSES, BOSS_MAP } from './data/bosses';
import { PERSONALITIES, PERSONALITY_MAP } from './data/personalities';
import { STAT_TIERS } from './data/stat-distribution';
import { generateNormalCharacter } from './generation';
import { bossCharacter } from './rules/setup';
import { normalRuleset } from './rules/ruleset';

export { BOSSES, BOSS_MAP };
export { PERSONALITIES, PERSONALITY_MAP };
export { STAT_TIERS };
export { STATUSES, STATUS_MAP } from './data/statuses';
export { generateNormalCharacter };
export { getAbility, ABILITY_LIST } from './abilities';
export { applyPassiveMods } from './rules/setup';

/** 生成域与版本：常规 PVP/PVE 共用，同名必同角色（DESIGN.md 决策 #26） */
export const NORMAL_GEN_KEY = 'normal';
/** v2：种子从"模组id"改为"生成域"，全量重roll一次（开服前变更，无历史包袱） */
export const NORMAL_GEN_VERSION = 2;

/** UnitCard 展示哪些数值、怎么展示——由模组声明（DESIGN.md 6.1①） */
export const NORMAL_STATS: StatMeta[] = [
  { id: 'hp', label: '生命', show: 'bar', barMaxStat: 'maxHp', color: '#f87171' },
  { id: 'mp', label: '法力', show: 'bar', barMaxStat: 'maxMp', color: '#60a5fa' },
  { id: 'atk', label: '攻击', show: 'pill', desc: '物理攻击' },
  { id: 'mag', label: '魔攻', show: 'pill', desc: '魔法攻击' },
  { id: 'pdef', label: '物防', show: 'pill' },
  { id: 'mdef', label: '魔防', show: 'pill' },
  { id: 'spd', label: '速度', show: 'pill' },
  { id: 'dodge', label: '闪避', show: 'pill', desc: '百分比' },
  { id: 'crit', label: '暴击', show: 'pill', desc: '百分比' },
  { id: 'critDmg', label: '暴伤', show: 'hidden' },
];

function validateMembers(units: UnitConfig[], max: number, sideLabel: string): string | null {
  if (units.length === 0) return `${sideLabel}至少需要 1 名队员`;
  if (units.length > max) return `${sideLabel}最多 ${max} 人`;
  for (const u of units) {
    const r = validateName(u.name);
    if (!r.ok) return `队员名不合法：${r.reason}`;
  }
  return null;
}

export function buildNormalMod(kind: 'pvp' | 'pve'): Mod {
  const id = `normal-${kind}`;
  const genVersion = 1;
  return {
    id,
    name: kind === 'pvp' ? '常规PVP' : '常规PVE',
    genKey: NORMAL_GEN_KEY,
    genVersion: NORMAL_GEN_VERSION,
    stats: NORMAL_STATS,
    generateCharacter: (_rng, opts) => generateNormalCharacter(opts.name, NORMAL_GEN_KEY, NORMAL_GEN_VERSION),
    rules: normalRuleset(kind, NORMAL_GEN_KEY, NORMAL_GEN_VERSION),
    team:
      kind === 'pvp'
        ? {
            maxUnits: 3,
            validateTeam(team: TeamConfig): string | null {
              return validateMembers(team.units, 3, `${team.side} 方`);
            },
            validateTeams(teams: TeamConfig[]): string | null {
              if (teams.length !== 2) return '常规PVP 需要两支队伍';
              for (const t of teams) {
                const err = validateMembers(t.units, 3, `${t.side} 方`);
                if (err) return err;
              }
              return null; // 人数不齐允许（多打少，不补人）
            },
          }
        : {
            maxUnits: 6,
            validateTeam(team: TeamConfig): string | null {
              return validateMembers(team.units, 6, `${team.side} 方`);
            },
            validateTeams(teams: TeamConfig[]): string | null {
              if (teams.length !== 2) return '常规PVE 需要盟军方与 Boss 方';
              const ally = teams.find((t) => t.side === 'A');
              if (!ally) return '缺少盟军方（A）';
              return validateMembers(ally.units, 6, '盟军方'); // B 方由 Boss 数据填充
            },
          },
    pveEnemies:
      kind === 'pve'
        ? (bossId) => {
            const def = BOSS_MAP.get(bossId) ?? BOSSES[0]!;
            return [{ name: def.name, side: 'B', char: bossCharacter(def) } as UnitConfig];
          }
        : undefined,
  };
}

export const NORMAL_PVP = buildNormalMod('pvp');
export const NORMAL_PVE = buildNormalMod('pve');
