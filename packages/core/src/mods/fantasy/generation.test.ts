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

  it('性别可选、职业纯随机：同选同名必同角色；选择参与种子（不同性别→不同六维）；非法性别拒绝', () => {
    // 同选确定性
    const a = generateFantasyCharacter('选性别', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: 'female' });
    const b = generateFantasyCharacter('选性别', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: 'female' });
    expect(b).toEqual(a);
    expect(a.gender).toBe('female');
    // 职业由种子随机（F52：不再可选）
    expect(JOBS.map((j) => j.id)).toContain(a.jobId);
    // 选择参与种子：同名字不同性别 → 角色不同（大概率）
    const c = generateFantasyCharacter('选性别', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: 'male' });
    expect(JSON.stringify(c.base) === JSON.stringify(a.base)).toBe(false);
    // 选择对属性无偏置：同性别职业随机的分布不变（六维仍走全量分布表）
    let sawHighStr = false;
    for (let i = 0; i < 60 && !sawHighStr; i++) {
      const k = generateFantasyCharacter(`随机${i}号`, FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: 'male' });
      if (k.base.str > 80) sawHighStr = true;
    }
    expect(sawHighStr).toBe(true);
    // 非法性别拒绝制
    expect(() => generateFantasyCharacter('选性别', FANTASY_GEN_KEY, FANTASY_GEN_VERSION, { gender: '未知' as never })).toThrow();
  });

  it('职业分布：大量生成时 11 职业都会出现（种子随机而非固定）', () => {
    const seen = new Set<string>();
    for (let i = 0; i < 220; i++) {
      seen.add(generateFantasyCharacter(`职业${i}号`, FANTASY_GEN_KEY, FANTASY_GEN_VERSION).jobId);
    }
    expect(seen.size).toBe(JOBS.length);
  });
});
