import type { Mod, StatMeta, TeamConfig, UnitConfig, ModDisplay } from '../../engine';
import { validateName } from '../../name-gen';
import { BOSSES, BOSS_MAP } from './data/bosses';
import { PERSONALITIES, PERSONALITY_MAP } from './data/personalities';
import { STAT_TIERS } from './data/stat-distribution';
import { generateNormalCharacter } from './generation';
import { bossCharacter } from './rules/setup';
import { normalRuleset } from './rules/ruleset';
import { applyPassiveMods } from './rules/setup';
import { getAbility } from './abilities';
import { STATUS_MAP } from './data/statuses';
import type { Character, DerivedStats } from './types';

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
  { id: 'dodge', label: '闪避', show: 'pill', format: 'pct', desc: '百分比' },
  { id: 'crit', label: '暴击', show: 'pill', format: 'pct', desc: '百分比' },
  { id: 'critDmg', label: '暴伤', show: 'hidden' },
];

/** 展示适配（ModDisplay）：normal 的六维/派生/能力/性格翻译成通用 UI 形态 */
const NORMAL_DISPLAY: ModDisplay = {
  sixStats: [
    { key: 'str', label: '力量', short: '力' },
    { key: 'wis', label: '智慧', short: '智' },
    { key: 'vit', label: '体力', short: '体' },
    { key: 'spr', label: '精神', short: '神' },
    { key: 'agi', label: '敏捷', short: '敏' },
    { key: 'luk', label: '幸运', short: '运' },
  ],
  tierLabel: (id) => STAT_TIERS.find((x) => x.id === id)?.label ?? '',
  derivedRows(char) {
    const c = char as Character;
    const d = applyPassiveMods(c.derived, c.abilities) as DerivedStats;
    return [
      { label: '生命', value: String(Math.round(d.maxHp)) },
      { label: '法力', value: String(Math.round(d.maxMp)) },
      { label: '攻击', value: String(Math.round(d.atk)) },
      { label: '魔攻', value: String(Math.round(d.mag)) },
      { label: '物防', value: String(Math.round(d.pdef)) },
      { label: '魔防', value: String(Math.round(d.mdef)) },
      { label: '速度', value: String(Math.round(d.spd * 10) / 10) },
      { label: '闪避', value: `${Math.round(d.dodge * 100)}%` },
      { label: '暴击', value: `${Math.round(d.crit * 100)}%` },
      { label: '暴伤', value: `${Math.round(d.critDmg * 100)}%` },
    ];
  },
  skills(char) {
    const c = char as Character;
    return c.abilities.map((a) => {
      const def = getAbility(a.id);
      return { id: a.id, name: def?.name ?? a.id, desc: def?.desc ?? '', kind: def?.kind ?? 'passive', cost: def?.cost ?? 0 };
    });
  },
  tags(char) {
    const p = PERSONALITY_MAP.get((char as Character).personalityId);
    return p ? [`${p.emoji}${p.name}`] : [];
  },
  statusBrief: (id) => {
    const s = STATUS_MAP.get(id);
    return s ? { name: s.name, kind: s.kind } : undefined;
  },
  roundLabel: '回合',
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

export function buildNormalMod(kind: 'pvp' | 'pve'): Mod {
  const id = `normal-${kind}`;
  const genVersion = 1;
  return {
    id,
    name: kind === 'pvp' ? '常规PVP' : '常规PVE',
    genKey: NORMAL_GEN_KEY,
    genVersion: NORMAL_GEN_VERSION,
    stats: NORMAL_STATS,
    display: NORMAL_DISPLAY,
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
    pveBosses:
      kind === 'pve'
        ? () => BOSSES.map((b) => ({ id: b.id, name: b.name, title: b.title, desc: b.desc }))
        : undefined,
  };
}

export const NORMAL_PVP = buildNormalMod('pvp');
export const NORMAL_PVE = buildNormalMod('pve');
