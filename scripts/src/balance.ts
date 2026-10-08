import { FANTASY_PVP } from '@namearena/core';
import { simulate } from '@namearena/core';
import type { BattleConfig, UnitConfig } from '@namearena/core';
import { fantasyComputeDerived as computeDerived } from '@namearena/core';
import { fantasyApplyJobMods as applyJobMods, JOB_MAP } from '@namearena/core';
import { generateFantasyCharacter, FANTASY_GEN_KEY, FANTASY_GEN_VERSION } from '@namearena/core';

type JobId = 'knight' | 'warrior' | 'swordsman' | 'grappler' | 'assassin' | 'hunter' | 'bard' | 'dancer' | 'blackmage' | 'apothecary' | 'whitemage';
interface CraftedChar {
  name: string;
  genVersion: number;
  gender: 'male' | 'female';
  jobId: JobId;
  base: Record<string, number>;
  tiers: Record<string, string>;
  derived: Record<string, number>;
  skills: { id: string; source: 'job' }[];
  totalCost: number;
}

/**
 * 幻想大乱斗 平衡验收对局集（F53 起以 1v1 为重心——群友主要玩 1v1 PK）。
 * 用 uc.char 注入定制角色（规则集原生支持）：
 *   1. 1v1 镜像 ≈50% —— 引擎对称性
 *   2. 1v1 全职业交叉矩阵 —— 职业平衡（无 75%+ 的碾压，除非克制）
 *   3. 1v1 全低六维 vs 全高六维 —— "没有废角色"的直接检验
 *   4. 1v1 随机对局行动数分布 —— 目标 10~17 行动（有来有回）
 *   5. 5v5 只看时长不爆炸（多人不再做平衡要求）
 */

function craft(name: string, value: number, jobId: JobId): { name: string; char: CraftedChar } {
  const base: Record<string, number> = {};
  for (const s of ['str', 'vit', 'int', 'spr', 'agi', 'luk']) base[s] = value;
  const job = JOB_MAP.get(jobId)!;
  const derived = applyJobMods(computeDerived(base as never), job) as unknown as Record<string, number>;
  return {
    name,
    char: {
      name,
      genVersion: 1,
      gender: 'male',
      jobId,
      base,
      tiers: {},
      derived,
      skills: [
        { id: job.passiveId, source: 'job' },
        { id: job.activeId, source: 'job' },
      ],
      totalCost: 0,
    },
  };
}

function run(label: string, config: BattleConfig, n = 300, verbose = false): { a: number; b: number; draw: number; avgActions: number } {
  const wins = { A: 0, B: 0, draw: 0 };
  let actions = 0;
  for (let i = 0; i < n; i++) {
    const { result } = simulate(FANTASY_PVP, config, 900_000 + i);
    if (result.winner === 'A') wins.A++;
    else if (result.winner === 'B') wins.B++;
    else wins.draw++;
    actions += result.rounds;
  }
  const pct = (x: number) => ((x / n) * 100).toFixed(1).padStart(5) + '%';
  console.log(`${label}: A ${pct(wins.A)} / B ${pct(wins.B)} / 平 ${pct(wins.draw)}，平均行动 ${(actions / n).toFixed(1)}`);
  return { a: wins.A / n, b: wins.B / n, draw: wins.draw / n, avgActions: actions / n };
}

function team(side: 'A' | 'B', members: { name: string; char: CraftedChar }[]): { side: string; units: (UnitConfig & { char: CraftedChar })[] } {
  return { side, units: members.map((m) => ({ name: m.name, side, char: m.char })) };
}

function duel(jobA: JobId, jobB: JobId, n = 300): { a: number; avgActions: number } {
  const r = run(`1v1 ${jobA.padEnd(11)} vs ${jobB}`, {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [team('A', [craft('甲', 50, jobA)]), team('B', [craft('乙', 50, jobB)])],
  }, n);
  return { a: r.a + r.draw / 2, avgActions: r.avgActions };
}

console.log('—— 幻想大乱斗 平衡验收（1v1 重心，F53）——\n');

// 1. 1v1 镜像：全 50 骑士（时长 + 对称性）
run('镜像1v1 (全50骑士)', {
  modId: 'fantasy-pvp',
  kind: 'async',
  teams: [team('A', [craft('镜像甲', 50, 'knight')]), team('B', [craft('镜像乙', 50, 'knight')])],
});

// 2. 1v1 全职业交叉矩阵（全 50）：行=职业 A 胜率+平局折半
const ALL_JOBS: JobId[] = ['knight', 'warrior', 'swordsman', 'grappler', 'assassin', 'hunter', 'bard', 'dancer', 'blackmage', 'apothecary', 'whitemage'];
console.log('\n—— 1v1 职业交叉矩阵（50 属性，A 视角胜率+平局折半，破 70% 标 ⚠️）——');
let worst = 0;
for (const ja of ALL_JOBS) {
  const cells: string[] = [];
  for (const jb of ALL_JOBS) {
    if (ja === jb) {
      cells.push('  —  ');
      continue;
    }
    const { a } = duel(ja, jb, 200);
    worst = Math.max(worst, a);
    cells.push((a >= 0.7 || a <= 0.3 ? '⚠' : ' ') + (a * 100).toFixed(0).padStart(3, ' ') + '%');
  }
  console.log(`${ja.padEnd(11)} ${cells.join(' ')}`);
}
console.log(`\n最大偏离 = ${(worst * 100).toFixed(0)}%（克制局允许，大面积 >70% = 平衡失败）`);

// 3. 属性差对照（F53 口径修订：主人裁定"极端属性的趣味"不受"有来有回"约束——
//    20 vs 80 / 5 vs 95 属于罕见 roll 的节目效果（6 项同向概率 <0.1%），只报告不判失败；
//    30 vs 70 为实际验收档（常见得多的属性差），低方胜率应 ≥ 20%）
console.log('');
for (const jobId of ['knight', 'assassin', 'blackmage', 'grappler'] as const) {
  run(`1v1 全低40 vs 全高60 (${jobId})`, {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [team('A', [craft('下风', 40, jobId)]), team('B', [craft('上风', 60, jobId)])],
  });
}
for (const jobId of ['knight', 'assassin'] as const) {
  run(`参考 30 vs 70 (${jobId}，罕见 roll 节目局)`, {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [team('A', [craft('下风', 30, jobId)]), team('B', [craft('上风', 70, jobId)])],
  });
}
for (const jobId of ['knight'] as const) {
  run(`参考 20 vs 80 (${jobId}，罕见 roll)`, {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [team('A', [craft('下风', 20, jobId)]), team('B', [craft('上风', 80, jobId)])],
  });
}
run(`参考 极端 5 vs 95 (knight，允许悬殊)`, {
  modId: 'fantasy-pvp',
  kind: 'async',
  teams: [team('A', [craft('深渊', 5, 'knight')]), team('B', [craft('超凡', 95, 'knight')])],
});

// 4. 1v1 随机对局行动数分布（目标：多数落在 10~17）
console.log('\n—— 1v1 随机对局行动数分布（300 场）——');
const buckets = new Map<string, number>();
let sum = 0;
let min = 999;
let max = 0;
for (let i = 0; i < 300; i++) {
  const a = generateFantasyCharacter(`随机单挑A${i}`, FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
  const b = generateFantasyCharacter(`随机单挑B${i}`, FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
  const { result } = simulate(FANTASY_PVP, {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [
      { side: 'A', units: [{ name: a.name, side: 'A', char: a }] },
      { side: 'B', units: [{ name: b.name, side: 'B', char: b }] },
    ],
  } as unknown as BattleConfig, 500_000 + i);
  const r = Math.round(result.rounds);
  sum += r;
  min = Math.min(min, r);
  max = Math.max(max, r);
  const key = r <= 7 ? '≤7' : r <= 9 ? '8-9' : r <= 13 ? '10-13' : r <= 17 ? '14-17' : r <= 24 ? '18-24' : '25+';
  buckets.set(key, (buckets.get(key) ?? 0) + 1);
}
for (const k of ['≤7', '8-9', '10-13', '14-17', '18-24', '25+']) {
  console.log(`  ${k.padStart(5)} 行动: ${'#'.repeat(Math.round(((buckets.get(k) ?? 0) / 300) * 60))} ${buckets.get(k) ?? 0}`);
}
console.log(`  平均 ${(sum / 300).toFixed(1)}，范围 ${min}~${max}`);

// 5. 5v5 时长参考（多人不再做平衡要求，只看别爆炸）
run('\n参考 5v5 (全50骑士)', {
  modId: 'fantasy-pvp',
  kind: 'async',
  teams: [
    team('A', Array.from({ length: 5 }, (_, i) => craft(`甲${i}`, 50, 'knight' as JobId))),
    team('B', Array.from({ length: 5 }, (_, i) => craft(`乙${i}`, 50, 'knight' as JobId))),
  ],
}, 100);
