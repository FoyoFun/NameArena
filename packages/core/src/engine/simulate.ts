import { battleSeed, hashString, makeRng } from '../name-gen';
import { createContext } from './context';
import type { BattleConfig, BattleEvent, BattleRecord, BattleResult, BattleState, Mod } from './types';

/**
 * 确定性战斗模拟（纯函数）：同 mod + 同 config + 同 seed ⇒ 同事件流。
 * 主循环归模组 Ruleset；引擎只负责驱动、事件编号与失控保护。
 */
export function simulate(
  mod: Mod,
  config: BattleConfig,
  seed: number,
): { events: BattleEvent[]; result: BattleResult; state: BattleState } {
  const rng = makeRng(seed);
  const { ctx, events } = createContext(config, rng);
  mod.rules.initBattle(ctx);
  let guard = 0;
  while (!mod.rules.isOver(ctx.state)) {
    mod.rules.nextAction(ctx);
    if (++guard > 200_000) {
      throw new Error(`battle runaway: mod=${mod.id} seed=${seed}（Ruleset 未收敛，疑似未设回合上限）`);
    }
  }
  const result = (ctx.state.scratch['result'] as BattleResult | undefined) ?? {
    winner: ctx.state.winner,
    rounds: ctx.state.round,
    reason: 'unknown',
  };
  return { events, result, state: ctx.state };
}

/** 服务器入口：确定性生成种子并模拟一次，返回可落库的最小战报。entropy 传入则结果随机。 */
export function createBattle(mod: Mod, config: BattleConfig, entropy?: number): BattleRecord {
  const configJson = JSON.stringify(config);
  const seed = entropy !== undefined ? battleSeed(configJson, entropy) : hashString(configJson);
  const { result } = simulate(mod, config, seed);
  return { config, seed, result };
}
