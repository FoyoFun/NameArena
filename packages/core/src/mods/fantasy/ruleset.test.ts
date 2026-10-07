import { describe, expect, it } from 'vitest';
import { simulate } from '../../engine';
import { FANTASY_PVP } from './mod';
import type { BattleConfig } from '../../engine';

function cfg(a: string[], b: string[]): BattleConfig {
  return {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [
      { side: 'A', units: a.map((name) => ({ name, side: 'A' })) },
      { side: 'B', units: b.map((name) => ({ name, side: 'B' })) },
    ],
  };
}

describe('幻想大乱斗 战斗引擎', () => {
  it('确定性：同配置同种子 ⇒ 同事件流', () => {
    const config = cfg(['张三'], ['李四']);
    const r1 = simulate(FANTASY_PVP, config, 12345);
    const r2 = simulate(FANTASY_PVP, config, 12345);
    expect(r2.events).toEqual(r1.events);
    expect(r2.result).toEqual(r1.result);
  });

  it('战斗必然终止且只有一个 battleEnd；血量不变量（不越界/不为负）', () => {
    for (let seed = 0; seed < 40; seed++) {
      const config = cfg(['张三', '李四', '王五'], ['赵六', '钱七', '孙八']);
      const { events, result } = simulate(FANTASY_PVP, config, seed);
      const ends = events.filter((e) => e.type === 'battleEnd');
      expect(ends.length).toBe(1);
      expect(result.winner === 'A' || result.winner === 'B' || result.winner === null).toBe(true);
      // 行动数封顶 = 初始 6 单位 × 15 = 90
      expect(result.rounds).toBeLessThanOrEqual(90);
      for (const u of (events[0]!.payload['units'] as Array<{ uid: string; stats: Record<string, number> }>)) {
        expect(u.stats['hp']).toBeGreaterThan(0);
      }
    }
  });

  it('镜像对局近似对称（300 场，A 胜率 40%~60%）', () => {
    const config = cfg(['张三', '李四', '王五'], ['张三', '李四', '王五']);
    let aWins = 0;
    const n = 300;
    for (let i = 0; i < n; i++) {
      const { result } = simulate(FANTASY_PVP, config, 77_000 + i);
      if (result.winner === 'A') aWins++;
    }
    const rate = aWins / n;
    expect(rate).toBeGreaterThan(0.4);
    expect(rate).toBeLessThan(0.6);
  });

  it('血量不变量：damage 后 hp = 前值 − 量（钳 0）', () => {
    const config = cfg(['张三', '李四'], ['赵六', '钱七']);
    for (let seed = 0; seed < 30; seed++) {
      const { events } = simulate(FANTASY_PVP, config, 9_000 + seed);
      const hp = new Map<string, number>();
      for (const ev of events) {
        const units = ev.payload['units'] as Array<{ uid: string; stats: Record<string, number> }> | undefined;
        if (ev.type === 'battleStart' && units) {
          for (const u of units) hp.set(u.uid, u.stats['hp']!);
          continue;
        }
        const uid = ev.payload['uid'] as string | undefined;
        if (!uid) continue;
        const before = hp.get(uid);
        if (before === undefined) continue;
        if (ev.type === 'damage') {
          const amount = ev.payload['amount'] as number;
          const after = ev.payload['hp'] as number;
          expect(Math.abs(Math.max(0, before - amount) - after)).toBeLessThanOrEqual(0.5);
          hp.set(uid, after);
        } else if (ev.type === 'heal') {
          const after = ev.payload['hp'] as number;
          expect(after).toBeGreaterThanOrEqual(before);
          hp.set(uid, after);
        }
      }
    }
  });

  it('战报含技能使用与伤害事件（战斗真的在打）', () => {
    const config = cfg(['张三'], ['李四']);
    const { events } = simulate(FANTASY_PVP, config, 42);
    expect(events.some((e) => e.type === 'skillUse')).toBe(true);
    expect(events.some((e) => e.type === 'damage')).toBe(true);
  });

  it('吟唱机制出现在事件流中（咏唱开始日志，若有吟唱技能被选中）', () => {
    // 多跑几个名字与种子，黑魔导/魔法池技能出现咏唱日志的概率极高
    let sawCast = false;
    for (let i = 0; i < 30 && !sawCast; i++) {
      const config = cfg([`咏唱A${i}`], [`咏唱B${i}`]);
      const { events } = simulate(FANTASY_PVP, config, 1_000 + i);
      sawCast = events.some((e) => e.type === 'skillUse' && e.payload['casting'] === true);
    }
    expect(sawCast).toBe(true);
  });
});
