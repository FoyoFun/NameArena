import { describe, expect, it } from 'vitest';
import { simulate } from '../../engine';
import type { BattleConfig } from '../../engine';
import { NORMAL_PVE, NORMAL_PVP } from './mod';
import { FORMULAS } from './data/formulas';

function pvpConfig(a: string[], b: string[]): BattleConfig {
  return {
    modId: 'normal-pvp',
    kind: 'async',
    teams: [
      { side: 'A', units: a.map((name) => ({ name, side: 'A' })) },
      { side: 'B', units: b.map((name) => ({ name, side: 'B' })) },
    ],
  };
}

function pveConfig(names: string[], bossId: string): BattleConfig {
  return {
    modId: 'normal-pve',
    kind: 'pve',
    teams: [
      { side: 'A', units: names.map((name) => ({ name, side: 'A' })) },
      { side: 'B', units: [] },
    ],
    bossId,
  };
}

describe('战斗模拟', () => {
  it('同配置同种子 ⇒ 完全相同的事件流与结果', () => {
    const cfg = pvpConfig(['张三', '李四', '王五'], ['赵六', '钱七', '孙八']);
    const r1 = simulate(NORMAL_PVP, cfg, 12345);
    const r2 = simulate(NORMAL_PVP, cfg, 12345);
    expect(JSON.stringify(r1.events)).toBe(JSON.stringify(r2.events));
    expect(r1.result).toEqual(r2.result);
  });

  it('不同种子 ⇒ 结果可不同（抽样验证存在差异）', () => {
    const cfg = pvpConfig(['张三', '李四', '王五'], ['赵六', '钱七', '孙八']);
    const winners = new Set<string | null>();
    for (let seed = 0; seed < 30; seed++) {
      const { result } = simulate(NORMAL_PVP, cfg, seed);
      winners.add(result.winner);
    }
    expect(winners.size).toBeGreaterThan(1);
  });

  it('战斗必然结束且回合数不超过上限', () => {
    for (let seed = 0; seed < 20; seed++) {
      const cfg = pvpConfig(['张三', '李四', '王五'], ['赵六', '钱七']);
      const { result, state } = simulate(NORMAL_PVP, cfg, seed);
      expect(result.rounds).toBeLessThanOrEqual(FORMULAS.maxRounds);
      expect(state.over).toBe(true);
      expect(result.reason).toMatch(/wipe|attrition/);
    }
  });

  it('多打少：1v3 也能正常打完', () => {
    for (let seed = 0; seed < 10; seed++) {
      const cfg = pvpConfig(['孤胆英雄'], ['赵六', '钱七', '孙八']);
      const { result } = simulate(NORMAL_PVP, cfg, seed);
      expect(result.rounds).toBeGreaterThan(0);
    }
  });

  it('事件流包含 battleStart 与 battleEnd，且 seq 连续', () => {
    const cfg = pvpConfig(['张三'], ['李四']);
    const { events } = simulate(NORMAL_PVP, cfg, 7);
    expect(events[0]!.type).toBe('battleStart');
    expect(events[events.length - 1]!.type).toBe('battleEnd');
    events.forEach((e, i) => expect(e.seq).toBe(i));
  });

  it('PVE：单人可挑战 Boss 且 Boss 由数据填充', () => {
    const cfg = pveConfig(['勇者'], 'slime-king');
    const { events, result } = simulate(NORMAL_PVE, cfg, 99);
    const start = events[0]!;
    const units = start.payload['units'] as { side: string; name: string }[];
    expect(units.some((u) => u.side === 'B' && u.name === '史莱姆之王')).toBe(true);
    expect(result.rounds).toBeGreaterThan(0);
  });

  it('大样本压测：200 场战斗无异常且表现合理', () => {
    let maxRounds = 0;
    for (let seed = 0; seed < 200; seed++) {
      const names = ['甲', '乙', '丙', '丁', '戊', '己'].map((n, i) => `${n}${i}`);
      const cfg = pvpConfig(names.slice(0, 3), names.slice(3));
      const { result } = simulate(NORMAL_PVP, cfg, seed);
      maxRounds = Math.max(maxRounds, result.rounds);
    }
    expect(maxRounds).toBeGreaterThan(1);
  });
});
