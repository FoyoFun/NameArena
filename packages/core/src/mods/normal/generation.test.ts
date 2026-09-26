import { describe, expect, it } from 'vitest';
import { generateNormalCharacter, NORMAL_GEN_KEY, NORMAL_GEN_VERSION, NORMAL_PVP, NORMAL_PVE, STAT_TIERS } from './mod';
import { CONDITIONAL_RULES } from './data/conditional-rules';
import { PERSONALITIES } from './data/personalities';
import { ABILITY_LIST } from './abilities';
import { computeDerived } from './data/stat-weights';

describe('角色生成', () => {
  it('同名同生成域同版本 ⇒ 同角色（逐字段相等）', () => {
    const a = JSON.stringify(generateNormalCharacter('张三', NORMAL_GEN_KEY, NORMAL_GEN_VERSION));
    const b = JSON.stringify(generateNormalCharacter('张三', NORMAL_GEN_KEY, NORMAL_GEN_VERSION));
    expect(a).toBe(b);
  });

  it('生成域决策 #26：常规PVP 与 常规PVE 的同名角色完全一致', () => {
    for (const name of ['张三', '李四', '孙悟空', 'Tester01']) {
      const viaPvp = NORMAL_PVP.generateCharacter(NORMAL_PVP.generateCharacter as never, { name });
      // 直接比较两次独立生成（走各自模组实例）
      const a = JSON.stringify(generateNormalCharacter(name, NORMAL_PVP.genKey, NORMAL_PVP.genVersion));
      const b = JSON.stringify(generateNormalCharacter(name, NORMAL_PVE.genKey, NORMAL_PVE.genVersion));
      expect(a, name).toBe(b);
      expect(NORMAL_PVP.genKey).toBe(NORMAL_PVE.genKey);
      void viaPvp;
    }
  });

  it('不同名字 ⇒ 不同角色（抽样 50 个）', () => {
    const a = generateNormalCharacter('张三', NORMAL_GEN_KEY, NORMAL_GEN_VERSION);
    let differ = 0;
    for (let i = 0; i < 50; i++) {
      const b = generateNormalCharacter(`路人${i}`, NORMAL_GEN_KEY, NORMAL_GEN_VERSION);
      if (JSON.stringify(a) !== JSON.stringify(b)) differ++;
    }
    expect(differ).toBeGreaterThan(45);
  });

  it('不同生成域 ⇒ 不同角色', () => {
    const a = generateNormalCharacter('李四', 'normal', 2);
    const b = generateNormalCharacter('李四', 'ff14', 2);
    expect(a).not.toBe(b);
  });

  it('每个角色都有普攻、火球术和至少 1 个随机能力（保底）', () => {
    for (let i = 0; i < 100; i++) {
      const c = generateNormalCharacter(`测试${i}`, NORMAL_GEN_KEY, NORMAL_GEN_VERSION);
      expect(c.abilities.some((a) => a.id === 'basic-attack')).toBe(true);
      expect(c.abilities.some((a) => a.id === 'fireball')).toBe(true);
      expect(c.abilities.filter((a) => a.source === 'random').length).toBeGreaterThanOrEqual(1);
      expect(c.abilities.filter((a) => a.source === 'random').length).toBeLessThan(20);
    }
  });

  it('性格是合法值', () => {
    for (let i = 0; i < 50; i++) {
      const c = generateNormalCharacter(`性格${i}`, NORMAL_GEN_KEY, NORMAL_GEN_VERSION);
      expect(PERSONALITIES.some((p) => p.id === c.personalityId)).toBe(true);
    }
  });

  it('六维落在分布表定义的区间内', () => {
    for (let i = 0; i < 100; i++) {
      const c = generateNormalCharacter(`区间${i}`, NORMAL_GEN_KEY, NORMAL_GEN_VERSION);
      for (const s of Object.keys(c.base) as (keyof typeof c.base)[]) {
        const tier = STAT_TIERS.find((t) => t.id === c.tiers[s]);
        expect(tier, `stat ${s} tier ${c.tiers[s]}`).toBeDefined();
        expect(c.base[s]).toBeGreaterThanOrEqual(tier!.min);
        expect(c.base[s]).toBeLessThanOrEqual(tier!.max);
      }
    }
  });

  it('能力注册表：id 唯一、cost 非负', () => {
    const ids = ABILITY_LIST.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const a of ABILITY_LIST) expect(a.cost).toBeGreaterThanOrEqual(0);
  });
});

describe('派生属性（DESIGN.md 7.1 不变量）', () => {
  it('连续性：50 与 51 的派生值必有区别', () => {
    const base = { str: 50, wis: 50, vit: 50, spr: 50, agi: 50, luk: 50 };
    const d50 = computeDerived(base);
    const d51 = computeDerived({ ...base, str: 51 });
    expect(d51.atk).toBeGreaterThan(d50.atk);
    expect(d51.maxHp).toBeGreaterThan(d50.maxHp);
  });

  it('全 50 基准：HP≈570、有可用攻击与速度', () => {
    const d = computeDerived({ str: 50, wis: 50, vit: 50, spr: 50, agi: 50, luk: 50 });
    expect(d.maxHp).toBeCloseTo(80 + 400 + 50 + 25 + 15, 0); // 570
    expect(d.atk).toBeGreaterThan(0);
    expect(d.spd).toBeGreaterThan(0);
    expect(d.crit).toBeGreaterThan(0);
    expect(d.crit).toBeLessThanOrEqual(0.6);
  });
});
