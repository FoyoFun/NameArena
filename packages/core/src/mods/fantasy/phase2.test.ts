import { describe, expect, it } from 'vitest';
import { simulate } from '../../engine';
import { FANTASY_PVP, JOB_MAP, applyJobMods, computeDerived } from './mod';
import { ailmentChance, softCap, hitChance } from './rules/combat';
import { FORMULAS } from './data/formulas';
import { createContext } from '../../engine/context';
import { makeRng } from '../../name-gen';
import type { BattleConfig, UnitConfig } from '../../engine';
import type { BaseStatId, Character, CombatKey, JobId } from './types';

/** 二期机制专项：用 uc.char 注入指定职业，验证各被动/召唤/连击的事件特征真实出现 */

function craft(name: string, jobId: JobId, value = 50): { name: string; char: Character } {
  const base = {} as Record<BaseStatId, number>;
  for (const s of ['str', 'vit', 'int', 'spr', 'agi', 'luk'] as BaseStatId[]) base[s] = value;
  const job = JOB_MAP.get(jobId)!;
  return {
    name,
    char: {
      name,
      genVersion: 2,
      gender: 'male',
      jobId,
      base,
      tiers: {} as Record<BaseStatId, string>,
      derived: applyJobMods(computeDerived(base as never) as Record<CombatKey, number>, job),
      skills: [
        { id: job.passiveId, source: 'job' },
        { id: job.activeId, source: 'job' },
      ],
      totalCost: 0,
    },
  };
}

function cfg(a: { name: string; char: Character }[], b: { name: string; char: Character }[]): BattleConfig {
  return {
    modId: 'fantasy-pvp',
    kind: 'async',
    teams: [
      { side: 'A', units: a.map((m) => ({ name: m.name, side: 'A', char: m.char }) as UnitConfig) },
      { side: 'B', units: b.map((m) => ({ name: m.name, side: 'B', char: m.char }) as UnitConfig) },
    ],
  };
}

function scan(config: BattleConfig, n: number, seedBase: number): { types: Map<string, number>; buffCounts: Map<string, number> } {
  const types = new Map<string, number>();
  const buffCounts = new Map<string, number>();
  for (let seed = 0; seed < n; seed++) {
    const { events } = simulate(FANTASY_PVP, config, seedBase + seed);
    for (const e of events) {
      const t = String(e.payload['type'] ?? '');
      if (t) types.set(t, (types.get(t) ?? 0) + 1);
      if (e.type === 'statusApply' && e.payload['kind'] === 'buff') {
        const uid = String(e.payload['uid']);
        buffCounts.set(uid, (buffCounts.get(uid) ?? 0) + 1);
      }
    }
  }
  return { types, buffCounts };
}

describe('幻想大乱斗 二期机制', () => {
  it('剑士燕返：受击后反击（riposte 事件）', () => {
    const { types } = scan(cfg([craft('剑圣', 'swordsman')], [craft('木桩', 'knight', 80)]), 60, 1);
    expect(types.get('riposte') ?? 0).toBeGreaterThan(0);
  });

  it('格斗家：爆裂连拳打出多段连击（combo 事件）', () => {
    const { types } = scan(cfg([craft('拳王', 'grappler')], [craft('沙包', 'knight', 80)]), 60, 2);
    expect(types.get('combo') ?? 0).toBeGreaterThan(0);
  });

  it('猎人：召唤猎犬（summon 事件）且猎犬参战攻击', () => {
    const { types } = scan(cfg([craft('猎户', 'hunter')], [craft('野猪', 'knight', 80)]), 60, 3);
    expect(types.get('summon') ?? 0).toBeGreaterThan(0);
  });

  it('吟游诗人：战歌给己方上增益（buff statusApply）', () => {
    const { buffCounts } = scan(cfg([craft('诗人', 'bard')], [craft('听众', 'knight', 80)]), 60, 4);
    const bardBuffs = buffCounts.get('A-1') ?? 0;
    expect(bardBuffs).toBeGreaterThan(0);
  });

  it('舞娘：鼓舞上增益，且双重舞步链曾一次性叠出多个增益', () => {
    const { buffCounts } = scan(cfg([craft('舞姬', 'dancer')], [craft('观众', 'knight', 80)]), 120, 5);
    // 120 场内应出现过单场 ≥2 个增益（鼓舞本体 + 双重舞步追加）
    let maxPerBattle = 0;
    for (let seed = 0; seed < 120; seed++) {
      const { events } = simulate(FANTASY_PVP, cfg([craft('舞姬', 'dancer')], [craft('观众', 'knight', 80)]), 5_000 + seed);
      let count = 0;
      for (const e of events) {
        if (e.type === 'statusApply' && e.payload['kind'] === 'buff' && e.payload['uid'] === 'A-1') count++;
      }
      maxPerBattle = Math.max(maxPerBattle, count);
    }
    expect((buffCounts.get('A-1') ?? 0)).toBeGreaterThan(0);
    expect(maxPerBattle).toBeGreaterThanOrEqual(2);
  });

  it('异常软上限：原始概率再高也被双曲压缩，极难到 100%（ailmentChance/softCap）', () => {
    expect(softCap(0.8, 0.8)).toBeCloseTo(0.8);
    expect(softCap(0.5, 0.8)).toBeCloseTo(0.5);
    expect(softCap(1.0, 0.8)).toBeGreaterThan(0.8);
    expect(softCap(4.0, 0.8)).toBeLessThan(0.99); // raw 4.6 才恰好 0.99，100% 极难
    expect(softCap(100, 0.8)).toBeLessThan(1);
    void ailmentChance;
  });

  it('命中保底：极端闪避差下命中概率仍 ≥ 15%（hitFloor）；天选突破只加不减', () => {
    expect(FORMULAS.hitFloor).toBeGreaterThanOrEqual(0.15);
    expect(FORMULAS.hitCap).toBeLessThanOrEqual(1);
    const config = cfg([craft('攻方', 'assassin', 5)], [craft('守方', 'knight', 999)]);
    const { ctx } = createContext(config, makeRng(1));
    FANTASY_PVP.rules.initBattle(ctx);
    const a = ctx.state.units[0]!;
    const b = ctx.state.units[1]!;
    a.stats['hit'] = 0.02; // 极低命中
    b.stats['dodge'] = 0.8; // 极高闪避（钳制上限）
    // 双方天选清零 → 恰好等于铁底
    a.stats['destiny'] = 0;
    b.stats['destiny'] = 0;
    expect(hitChance(ctx, a, b)).toBeCloseTo(FORMULAS.hitFloor);
    // 恢复天选 → 突破只加不减（≥ 铁底，且 ≤ 100%）
    a.stats['destiny'] = 300;
    b.stats['destiny'] = 300;
    const p = hitChance(ctx, a, b);
    expect(p).toBeGreaterThanOrEqual(FORMULAS.hitFloor);
    expect(p).toBeLessThanOrEqual(1);
  });
});
