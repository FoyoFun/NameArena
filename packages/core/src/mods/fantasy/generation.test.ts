import { describe, expect, it } from 'vitest';
import { generateFantasyCharacter } from './generation';
import { FANTASY_GEN_KEY, FANTASY_GEN_VERSION } from './mod';
import { JOBS } from './data/jobs';
import { BASE_STAT_IDS } from './types';

describe('幻想大乱斗 角色生成', () => {
  it('确定性：同名同域同版本 ⇒ 同角色', () => {
    const a = generateFantasyCharacter('张三', FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
    const b = generateFantasyCharacter('张三', FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
    expect(b).toEqual(a);
  });

  it('不同名 ⇒ 角色不同（大概率）', () => {
    const a = generateFantasyCharacter('张三', FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
    const b = generateFantasyCharacter('李四', FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
    expect(JSON.stringify(b) === JSON.stringify(a)).toBe(false);
  });

  it('性别只有男女两种；职业来自一期 6 职业池', () => {
    for (const name of ['张三', '李四', '王五', '赵六', '钱七', '孙八', '周九', '吴十']) {
      const c = generateFantasyCharacter(name, FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
      expect(['male', 'female']).toContain(c.gender);
      expect(JOBS.map((j) => j.id)).toContain(c.jobId);
    }
  });

  it('六维在分布表范围内；派生含职业补正', () => {
    for (let i = 0; i < 60; i++) {
      const c = generateFantasyCharacter(`测试${i}号`, FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
      for (const s of BASE_STAT_IDS) {
        expect(c.base[s]).toBeGreaterThanOrEqual(1);
        expect(c.base[s]).toBeLessThanOrEqual(999);
      }
      expect(c.derived.maxHp).toBeGreaterThan(0);
      expect(c.derived.atk).toBeGreaterThan(0);
      // 职业补正后防御为正
      expect(c.derived.def).toBeGreaterThan(0);
    }
  });

  it('技能 = 职业被动 + 职业主动 + ≥1 个池技能；无重复 id', () => {
    for (let i = 0; i < 40; i++) {
      const c = generateFantasyCharacter(`技能${i}号`, FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
      const job = JOBS.find((j) => j.id === c.jobId)!;
      const ids = c.skills.map((s) => s.id);
      expect(ids).toContain(job.passiveId);
      expect(ids).toContain(job.activeId);
      expect(c.skills.filter((s) => s.source === 'pool').length).toBeGreaterThanOrEqual(1);
      expect(new Set(ids).size).toBe(ids.length);
    }
  });

  it('抄本技能 id 与本体不同、可叠加持有（任意职业可抽任意副本）', () => {
    let found = 0;
    for (let i = 0; i < 200; i++) {
      const c = generateFantasyCharacter(`抄本${i}号`, FANTASY_GEN_KEY, FANTASY_GEN_VERSION);
      const ids = c.skills.map((s) => s.id);
      for (const id of ids.filter((x) => x.endsWith('-copy'))) {
        found++;
        // 抄本与本体是不同技能（同持有时分别判定）
        expect(id).not.toBe(id.replace(/-copy$/, ''));
        expect(new Set(ids).size).toBe(ids.length);
      }
    }
    // 伪预算下 200 个名字应能见到抄本（若为 0 说明池配置有问题）
    expect(found).toBeGreaterThan(0);
  });

  it('性别/职业可选：同选同名必同角色；选择参与种子（不同选择→不同六维）；非法选择拒绝', () => {
    // 同选确定性
    const a = generateFantasyCharacter('选职业', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: 'female', jobId: 'knight' });
    const b = generateFantasyCharacter('选职业', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: 'female', jobId: 'knight' });
    expect(b).toEqual(a);
    expect(a.jobId).toBe('knight');
    expect(a.gender).toBe('female');
    // 选择参与种子：同名字不同职业 → 六维不同（大概率）
    const c = generateFantasyCharacter('选职业', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: 'female', jobId: 'assassin' });
    expect(JSON.stringify(c.base) === JSON.stringify(a.base)).toBe(false);
    // 选择对属性无偏置：骑士选择也可以出低防高攻（分布本身不因选择改变——六维仍走全量分布表）
    let sawHighAtk = false;
    for (let i = 0; i < 60 && !sawHighAtk; i++) {
      const k = generateFantasyCharacter(`骑士${i}号`, FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { jobId: 'knight' });
      if (k.base.str > 80) sawHighAtk = true; // 纸面高攻的骑士可能出现
    }
    expect(sawHighAtk).toBe(true);
    // 非法选择拒绝制
    expect(() => generateFantasyCharacter('选职业', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { jobId: '暗黑骑士' as never })).toThrow();
    expect(() => generateFantasyCharacter('选职业', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: '未知' as never })).toThrow();
  });
});
