import type { CombatKey, DerivedStats, JobId } from '../types';

/**
 * 职业数据表（DESIGN-FANTASY.md §3.3）。
 * 仇恨按主人要求存 ×1000 整数（Q13），计算时除回。
 * 补正：mult 乘区作用于 atk/def/spd/maxHp；add 直接加到百分比属性（点数）。
 * v2（2026-10-07）：11 职业全部就位，进入随机池。
 */
export interface JobDef {
  id: JobId;
  name: string;
  /** 仇恨 ×1000 整数 */
  hate: number;
  /** 属性补正方向（数值可调） */
  mods: {
    mult?: Partial<Pick<DerivedStats, 'atk' | 'def' | 'spd' | 'maxHp'>>;
    add?: Partial<Pick<DerivedStats, 'crit' | 'hit' | 'dodge' | 'resist' | 'absorb' | 'destiny' | 'ailment'>>;
  };
  passiveId: string;
  activeId: string;
  desc: string;
}

export const JOBS: JobDef[] = [
  {
    id: 'knight',
    name: '骑士',
    hate: 1800,
    mods: { mult: { def: 1.3, maxHp: 1.25 }, add: { resist: 0.15 } },
    passiveId: 'knight-oath',
    activeId: 'knight-thrust',
    desc: '重甲先锋，替队友承伤，偶尔把伤害挡成 1 点。',
  },
  {
    id: 'warrior',
    name: '战士',
    hate: 1600,
    mods: { mult: { def: 1.2, maxHp: 1.2 } },
    passiveId: 'warrior-bloodthirst',
    activeId: 'warrior-bloodstrike',
    desc: '越战越勇的绞肉机，造成伤害就能回血。',
  },
  {
    id: 'assassin',
    name: '刺客',
    hate: 850,
    mods: { mult: { atk: 1.2, spd: 1.15 }, add: { crit: 0.1 } },
    passiveId: 'assassin-instinct',
    activeId: 'assassin-venom',
    desc: '无视阵型直取后排，刃上喂毒。',
  },
  {
    id: 'blackmage',
    name: '黑魔导师',
    hate: 750,
    mods: { mult: { atk: 1.3 } },
    passiveId: 'blackmage-swelling',
    activeId: 'blackmage-flare',
    desc: '蓄力越久爆发越狠——速度对他是双刃剑。',
  },
  {
    id: 'apothecary',
    name: '药师',
    hate: 1000,
    mods: { mult: { atk: 1.1, def: 1.1 } },
    passiveId: 'apothecary-pharmacy',
    activeId: 'apothecary-elixir',
    desc: '药罐子，打人附带负面，奶人附带正面。',
  },
  {
    id: 'whitemage',
    name: '白魔导师',
    hate: 900,
    mods: { mult: { atk: 1.2 } },
    passiveId: 'whitemage-grace',
    activeId: 'whitemage-smite',
    desc: '以攻代奶，出手伤敌之余顺手捞一把队友。',
  },
  {
    id: 'swordsman',
    name: '剑士',
    hate: 1300,
    mods: { mult: { atk: 1.15, def: 1.15 } },
    passiveId: 'swordsman-riposte',
    activeId: 'swordsman-slash',
    desc: '攻守一体的剑客，挨打也会还手。',
  },
  {
    id: 'grappler',
    name: '格斗家',
    hate: 1200,
    mods: { mult: { atk: 1.15, spd: 1.1 }, add: { absorb: 0.1 } },
    passiveId: 'grappler-combo',
    activeId: 'grappler-barrage',
    desc: '连击越多拳头越重，连拳起来没完没了。',
  },
  {
    id: 'hunter',
    name: '猎人',
    hate: 700,
    mods: { mult: { atk: 1.1, spd: 1.1 }, add: { crit: 0.08 } },
    passiveId: 'hunter-mark',
    activeId: 'hunter-call',
    desc: '与猎犬协同作战，给猎物打上层层易伤印记。',
  },
  {
    id: 'bard',
    name: '吟游诗人',
    hate: 650,
    mods: { mult: { spd: 1.25 }, add: { dodge: 0.05 } },
    passiveId: 'bard-song',
    activeId: 'bard-hymn',
    desc: '弹着琴唱着歌，友方的增益就一首首来了。',
  },
  {
    id: 'dancer',
    name: '舞娘',
    hate: 600,
    mods: { mult: { spd: 1.25 }, add: { absorb: 0.08 } },
    passiveId: 'dancer-steps',
    activeId: 'dancer-inspire',
    desc: '舞步翩跹，增益上得一个又一个。',
  },
];

export const JOB_MAP = new Map(JOBS.map((j) => [j.id, j]));

/** 叠加职业补正（在 computeDerived 之后调用） */
export function applyJobMods(d: DerivedStats, job: JobDef): DerivedStats {
  const out = { ...d };
  for (const [k, m] of Object.entries(job.mods.mult ?? {}) as [keyof DerivedStats, number][]) {
    out[k] = out[k] * m;
  }
  for (const [k, a] of Object.entries(job.mods.add ?? {}) as [CombatKey, number][]) {
    out[k] = out[k] + a;
  }
  return out;
}
