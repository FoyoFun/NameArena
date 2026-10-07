import { FANTASY_PVP } from '@namearena/core';
import { simulate } from '@namearena/core';
import type { BattleConfig, UnitConfig } from '@namearena/core';
import { fantasyComputeDerived as computeDerived } from '@namearena/core';
import { fantasyApplyJobMods as applyJobMods, JOB_MAP } from '@namearena/core';

type JobId = 'knight' | 'warrior' | 'assassin' | 'blackmage' | 'apothecary' | 'whitemage';
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
 * 幻想大乱斗 平衡验收对局集（DESIGN-FANTASY.md §6.3）。
 * 用 uc.char 注入定制角色（规则集原生支持），跑标志性对局：
 *   1. 镜像（同名同队）≈50% —— 引擎对称性
 *   2. 全低六维 vs 全高六维 ≈50% —— "没有废角色"的直接检验
 *   3. 时长统计：1v1 / 3v3 / 5v5
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

function run(label: string, config: BattleConfig, n = 300): void {
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
}

function team(side: 'A' | 'B', members: { name: string; char: CraftedChar }[]): { side: string; units: (UnitConfig & { char: CraftedChar })[] } {
  return { side, units: members.map((m) => ({ name: m.name, side, char: m.char })) };
}

console.log('—— 幻想大乱斗 平衡验收 ——');

// 1. 镜像：全 50 骑士 1v1 / 3v3 / 5v5（时长 + 对称性）
for (const size of [1, 3, 5]) {
  const members = Array.from({ length: size }, (_, i) => craft(`镜像${i}`, 50, 'knight'));
  run(`镜像${size}v${size} (全50骑士)`, {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [team('A', members), team('B', members.map((m) => ({ name: m.name, char: m.char })))],
  });
}

// 2. 全低(5) vs 全高(95)：同职业对照（"没有废角色"直接检验）
for (const jobId of ['knight', 'assassin', 'blackmage'] as const) {
  const low = Array.from({ length: 3 }, (_, i) => craft(`深渊${i}`, 5, jobId));
  const high = Array.from({ length: 3 }, (_, i) => craft(`超凡${i}`, 95, jobId));
  run(`全低5 vs 全高95 ×3 (${jobId})`, {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [team('A', low), team('B', high)],
  });
}

// 3. 混编：低队（全属性≤20 随机职业）vs 高队（全属性≥80）——极端对局
console.log('\n（对照：全低 vs 全高 应≈50%；显著偏离说明高低映射失衡）');
