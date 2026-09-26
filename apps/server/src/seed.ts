import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db } from './db/db';
import { players, teams } from './db/schema';

/**
 * 首次运行种子数据：系统账号 + 几支已入池的示例队伍（方便立刻有东西可打）。
 * 幂等：已初始化则跳过。
 */

const SYSTEM_TOKEN = 'system';

const SAMPLE_TEAMS: Array<{ modId: string; members: string[] }> = [
  { modId: 'normal-pvp', members: ['关羽', '张飞', '赵云'] },
  { modId: 'normal-pvp', members: ['宋江', '武松', '林冲'] },
  { modId: 'normal-pvp', members: ['孙悟空', '猪八戒', '沙僧'] },
  { modId: 'normal-pvp', members: ['张伟', '王芳', '李娜'] },
  { modId: 'normal-pvp', members: ['叶问'] },
  { modId: 'normal-pvp', members: ['诸葛亮', '司马懿'] },
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
        membersJson: JSON.stringify(t.members.map((name) => ({ name }))),
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
