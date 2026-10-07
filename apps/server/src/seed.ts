import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/db';
import { players, teams } from './db/schema';

/**
 * 首次运行种子数据：系统账号 + 几支已入池的示例队伍（方便立刻有东西可打）。
 * 幂等：已初始化则跳过。
 */

const SYSTEM_TOKEN = 'system';

const SAMPLE_TEAMS: Array<{ modId: string; members: Array<string | { name: string; opts?: Record<string, unknown> }> }> = [
  // 幻想大乱斗示范队（F47：常规模式已退场；选择参与种子、无属性偏置）
  { modId: 'fantasy-pvp', members: [{ name: '圣女贞德', opts: { gender: 'female', jobId: 'whitemage' } }, { name: '玛尔达', opts: { gender: 'female', jobId: 'knight' } }, { name: '埃克莱尔', opts: { jobId: 'apothecary' } }] },
  { modId: 'fantasy-pvp', members: [{ name: '无名剑客', opts: { jobId: 'swordsman' } }, { name: '影蟒', opts: { gender: 'male', jobId: 'assassin' } }, { name: '轰天拳王', opts: { jobId: 'grappler' } }] },
  { modId: 'fantasy-pvp', members: [{ name: '莉拉', opts: { gender: 'female', jobId: 'dancer' } }, { name: '缪斯', opts: { gender: 'female', jobId: 'bard' } }, { name: '贝希摩斯', opts: { jobId: 'hunter' } }] },
  { modId: 'fantasy-pvp', members: [{ name: '虚空贤者', opts: { jobId: 'blackmage' } }] },
  { modId: 'fantasy-pvp', members: [{ name: '铁壁骑士团', opts: { jobId: 'knight' } }, { name: '狂战之魂', opts: { jobId: 'warrior' } }] },
];

function main() {
  const existing = db.select().from(players).where(eq(players.token, SYSTEM_TOKEN)).get();
  if (existing) {
    console.log('种子数据已存在，跳过');
    return;
  }
  db.insert(players).values({ token: SYSTEM_TOKEN, nickname: '系统', discr: '0000', createdAt: new Date().toISOString() }).run();
  const now = new Date().toISOString();
  for (const t of SAMPLE_TEAMS) {
    db.insert(teams)
      .values({
        id: randomUUID(),
        ownerToken: SYSTEM_TOKEN,
        modId: t.modId,
        membersJson: JSON.stringify(
          t.members.map((m) => (typeof m === 'string' ? { name: m } : { name: m.name, opts: m.opts })),
        ),
        createdAt: now,
        inPoolAt: now, // 种子队直接入池
        wins: 0,
        losses: 0,
      })
      .run();
  }
  console.log(`已写入 ${SAMPLE_TEAMS.length} 支示例队伍（系统#0000）`);
}

main();
