import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { eq, lt, sql } from 'drizzle-orm';
import { db } from './db/db';
import { battles, players, teams } from './db/schema';
import { registerRoutes } from './routes';

const __dirname = dirname(fileURLToPath(import.meta.url));

const app = Fastify({
  logger: { transport: undefined, level: 'info' },
});

await app.register(cors, { origin: true });
registerRoutes(app);

// ---- 定期清扫（决策 #66）----

const BATTLE_TTL_MS = 3 * 24 * 3600_000; // 战报保留 3 天
const INACTIVE_MS = 7 * 24 * 3600_000; // 7 天未登录 → 清其全部队伍
const SWEEP_INTERVAL_MS = 3600_000;

function sweep(): void {
  const battleCutoff = new Date(Date.now() - BATTLE_TTL_MS).toISOString();
  const goneBattles = db.delete(battles).where(lt(battles.createdAt, battleCutoff)).run().changes;
  const playerCutoff = new Date(Date.now() - INACTIVE_MS).toISOString();
  const stale = db
    .select({ token: players.token })
    .from(players)
    .where(sql`COALESCE(${players.lastSeenAt}, ${players.createdAt}) < ${playerCutoff}`)
    .all();
  let goneTeams = 0;
  for (const p of stale) {
    goneTeams += db.delete(teams).where(eq(teams.ownerToken, p.token)).run().changes;
  }
  if (goneBattles > 0 || goneTeams > 0) {
    console.log(`[sweep] 清理过期战报 ${goneBattles} 条、7 天未登录玩家的队伍 ${goneTeams} 支`);
  }
}

sweep();
const sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
sweepTimer.unref(); // 不阻止进程退出

// 生产模式：同时托管前端构建产物（hash 路由，无需 SPA fallback），单进程单端口。
// HTML 禁缓存（决策 #71）：资源文件名带 hash 可长缓存，但 index.html 若被浏览器
// 缓存，部署新版后手机会一直跑旧页面（真实踩过：手机强缓存导致"改了没生效"）。
// fastifyStatic 的 setHeaders 对 index 回退不生效，改用 onSend 钩子按响应类型兜底。
const webDist = join(__dirname, '..', '..', 'web', 'dist');
if (existsSync(webDist)) {
  await app.register(fastifyStatic, { root: webDist, prefix: '/', wildcard: false });
  app.addHook('onSend', (req, reply, payload, done) => {
    const ct = reply.getHeader('content-type');
    if (typeof ct === 'string' && ct.startsWith('text/html')) {
      reply.header('cache-control', 'no-cache');
    }
    done(null, payload);
  });
}

const port = Number(process.env.PORT ?? 8787);
await app.listen({ port, host: '0.0.0.0' });
console.log(`NameArena server listening on http://localhost:${port}`);
