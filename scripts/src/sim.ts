import { BOSS_MAP, getMod } from '@namearena/core';
import { simulate } from '@namearena/core';
import type { BattleConfig, Mod } from '@namearena/core';
import { hashString, makeRng } from '@namearena/core';

/**
 * 批量模拟 CLI（DESIGN.md 7.10 数值调和工具链）。
 *
 * 用法：
 *   pnpm sim -- 张三 李四 王五 --vs 赵六 钱七 孙八 [-n 500]
 *   pnpm sim -- 勇者 法师 --pve slime-king [-n 500]
 *   pnpm sim -- 张三 --vs 李四 --mod fantasy-pvp [-n 500]   # 幻想大乱斗
 *
 * 每改一个数值旋钮（分布表/λ/cost表/公式系数），必须跑一遍看胜率分布。
 */

function parseArgs(argv: string[]) {
  const sideA: string[] = [];
  let sideB: string[] = [];
  let bossId: string | null = null;
  let n = 500;
  let mode: 'vs' | 'pve' = 'vs';
  let modId = 'fantasy-pvp';
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (a === '--') continue; // pnpm 透传的分隔符
    if (a === '--vs') {
      mode = 'vs';
      let j = i + 1;
      for (; j < argv.length && !argv[j]!.startsWith('-'); j++) sideB.push(argv[j]!);
      i = j - 1;
    } else if (a === '--pve') {
      mode = 'pve';
      bossId = argv[++i] ?? null;
    } else if (a === '--mod') {
      modId = argv[++i] ?? 'fantasy-pvp';
    } else if (a === '-n') {
      n = Number(argv[++i] ?? 500);
    } else {
      sideA.push(a);
    }
  }
  return { sideA, sideB, bossId, n, mode, modId };
}

function main() {
  const argv = process.argv.slice(2);
  const { sideA, sideB, bossId, n, mode, modId } = parseArgs(argv);
  if (sideA.length === 0) {
    console.log('用法：pnpm sim -- 张三 李四 王五 --vs 赵六 钱七 孙八 [-n 500] [--mod fantasy-pvp|fantasy-pve]');
    console.log('      pnpm sim -- 勇者 法师 --pve slime-king [-n 500]');
    process.exit(1);
  }

  let config: BattleConfig;
  if (mode === 'pve') {
    const id = bossId ?? 'slime-king';
    if (!BOSS_MAP.has(id)) {
      console.error(`未知 Boss：${id}（可选：${[...BOSS_MAP.keys()].join(', ')}）`);
      process.exit(1);
    }
    config = {
      modId: 'normal-pve',
      kind: 'pve',
      teams: [
        { side: 'A', units: sideA.map((name) => ({ name, side: 'A' })) },
        { side: 'B', units: [] },
      ],
      bossId: id,
    };
    console.log(`⚔️  PVE：【${sideA.join('、')}】 vs 【${BOSS_MAP.get(id)!.name}】× ${n} 场\n`);
  } else {
    if (sideB.length === 0) {
      console.error('--vs 后面要给另一队的名字');
      process.exit(1);
    }
    config = {
      modId,
      kind: 'async',
      teams: [
        { side: 'A', units: sideA.map((name) => ({ name, side: 'A' })) },
        { side: 'B', units: sideB.map((name) => ({ name, side: 'B' })) },
      ],
    };
    console.log(`⚔️  PVP(${modId})：【${sideA.join('、')}】 vs 【${sideB.join('、')}】× ${n} 场\n`);
  }

  // 展示双方角色卡片摘要（走模组通用接口，跨模组可用）
  const mod: Mod = getMod(config.modId);
  for (const team of config.teams) {
    if (team.units.length === 0) continue;
    console.log(`— ${team.side} 方 —`);
    for (const u of team.units) {
      const c = mod.generateCharacter(makeRng(hashString(`${config.modId}|${u.name}`)), { name: u.name }) as {
        base: Record<string, number>;
        totalCost: number;
        abilities?: unknown[];
        skills?: unknown[];
      };
      const six = Object.entries(c.base)
        .map(([k, v]) => `${k}:${v}`)
        .join(' ');
      const kitLen = (c.abilities ?? c.skills ?? []).length;
      console.log(`  ${u.name} [${six}] cost=${c.totalCost} 技能=${kitLen}`);
    }
  }
  console.log();

  const wins = { A: 0, B: 0, draw: 0 };
  let totalRounds = 0;
  let totalEvents = 0;
  const configJson = JSON.stringify(config);
  for (let i = 0; i < n; i++) {
    const seed = hashString(`${configJson}|${i}`);
    const { events, result } = simulate(mod, config, seed);
    if (result.winner === 'A') wins.A++;
    else if (result.winner === 'B') wins.B++;
    else wins.draw++;
    totalRounds += result.rounds;
    totalEvents += events.length;
  }

  const pct = (x: number) => ((x / n) * 100).toFixed(1).padStart(5) + '%';
  console.log(`结果（A 方胜率视角）：`);
  console.log(`  A 胜 ${pct(wins.A)}   B 胜 ${pct(wins.B)}   平局 ${pct(wins.draw)}`);
  console.log(`  平均回合数 ${(totalRounds / n).toFixed(1)}，平均事件数 ${(totalEvents / n).toFixed(0)}`);
  const aRate = wins.A / n;
  if (aRate > 0.75 || aRate < 0.25) {
    console.log(`  ⚠️ 胜率偏离 50% 过大——检查是不是克制/数值碾压，是否符合"属性≠强弱"预期`);
  }
}

main();
