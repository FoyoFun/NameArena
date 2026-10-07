import { applyJobMods, JOB_MAP } from './jobs';
import { computeDerived } from './stat-weights';
import type { BaseStatId, Character, JobId, SixStats } from '../types';

/**
 * 幻想大乱斗 PVE Boss 数据表（三期实装，DESIGN-FANTASY.md §6.4/§8.2）。
 * Boss 不走名字生成：固定职业 + 固定六维 + 固定技能组（均用已注册技能 id）。
 * 地狱 Boss 为多单位编队（PVE 敌人可以有多个单位）。
 */
export interface FantasyBossUnit {
  name: string;
  jobId: JobId;
  base: SixStats;
  skills: string[];
}

export interface FantasyBossDef {
  id: string;
  name: string;
  title: string;
  desc: string;
  units: FantasyBossUnit[];
}

function flat(v: number): SixStats {
  return { str: v, vit: v, int: v, spr: v, agi: v, luk: v } as SixStats;
}

export const FANTASY_BOSSES: FantasyBossDef[] = [
  {
    id: 'slime-king',
    name: '史莱姆之王',
    title: '普通',
    desc: '黏液翻滚的巨大史莱姆，打人顺带回血，适合新手试炼。',
    units: [
      {
        name: '史莱姆之王',
        jobId: 'warrior',
        base: flat(42),
        skills: ['warrior-bloodthirst', 'warrior-bloodstrike', 'pool-heal-light', 'pool-rejuvenation'],
      },
    ],
  },
  {
    id: 'stone-golem',
    name: '磐石魔像',
    title: '困难',
    desc: '古代守护石像，铁壁眩晕流，磨也磨不动、撞也撞不过。',
    units: [
      {
        name: '磐石魔像',
        jobId: 'knight',
        base: flat(68),
        skills: ['knight-oath', 'knight-thrust', 'pool-skull-cracker', 'pool-glaciate'],
      },
    ],
  },
  {
    id: 'void-devourer',
    name: '虚空吞噬者',
    title: '地狱',
    desc: '来自虚空的吞噬者与两只虚空猎犬，蓄力毁灭一击与层层猎印。',
    units: [
      {
        name: '虚空吞噬者',
        jobId: 'blackmage',
        base: flat(92),
        skills: ['blackmage-swelling', 'blackmage-flare', 'pool-glaciate', 'pool-vampiric-fang'],
      },
      {
        name: '虚空猎犬·左',
        jobId: 'hunter',
        base: flat(45),
        skills: ['hunter-mark', 'hunter-call', 'pool-poison-strike'],
      },
      {
        name: '虚空猎犬·右',
        jobId: 'assassin',
        base: flat(45),
        skills: ['assassin-instinct', 'assassin-venom', 'pool-rend'],
      },
    ],
  },
];

export const FANTASY_BOSS_MAP = new Map(FANTASY_BOSSES.map((b) => [b.id, b]));

/** Boss 单位定义 → Character（不走名字生成，无池技能、无 cost） */
export function bossCharacter(def: FantasyBossUnit): Character {
  const job = JOB_MAP.get(def.jobId)!;
  return {
    name: def.name,
    genVersion: 0,
    gender: 'male',
    jobId: def.jobId,
    base: { ...def.base },
    tiers: {} as Record<BaseStatId, string>,
    derived: applyJobMods(computeDerived(def.base), job),
    skills: def.skills.map((id) => ({ id, source: 'job' as const })),
    totalCost: 0,
  };
}
