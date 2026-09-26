import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { createBattle, getMod, MODS, validateName, BOSS_MAP } from '@namearena/core';
import type { BattleConfig } from '@namearena/core';
import { db, sqlite } from './db/db';
import { battles, ladder, players, teams } from './db/schema';

// ---------- 工具 ----------

function now(): string {
  return new Date().toISOString();
}

function displayName(p: { nickname: string; discr: string }): string {
  return `${p.nickname}#${p.discr}`;
}

function getPlayerByToken(token: string | undefined) {
  if (!token) return null;
  return db.select().from(players).where(eq(players.token, token)).get() ?? null;
}

function requirePlayer(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers['x-token'] as string | undefined;
  const player = getPlayerByToken(token);
  if (!player) {
    reply.code(401).send({ error: '需要有效的身份令牌（请刷新页面重新注册）' });
    return null;
  }
  return player;
}

function parseTeam(row: typeof teams.$inferSelect) {
  const owner = getPlayerByToken(row.ownerToken);
  return {
    id: row.id,
    modId: row.modId,
    members: (JSON.parse(row.membersJson) as { name: string }[]).map((m) => m.name),
    owner: owner ? displayName(owner) : '未知',
    mine: false,
    wins: row.wins,
    losses: row.losses,
    inPool: row.inPoolAt !== null,
    createdAt: row.createdAt,
  };
}

// 新昵称的编号：随机 4 位，冲突重试
function randomDiscr(): string {
  return String(Math.floor(Math.random() * 10000)).padStart(4, '0');
}

function insertPlayer(nickname: string): { token: string; nickname: string; discr: string } {
  for (let i = 0; i < 100; i++) {
    const token = randomUUID();
    const discr = randomDiscr();
    try {
      db.insert(players).values({ token, nickname, discr, createdAt: now() }).run();
      return { token, nickname, discr };
    } catch {
      // (nickname, discr) 冲突 → 换编号重试
    }
  }
  throw new Error('编号分配失败，请重试');
}

// ---------- 战斗记账 ----------

const ladderWin = sqlite.prepare(
  `INSERT INTO ladder (mod_id, name, wins, losses) VALUES (?, ?, 1, 0)
   ON CONFLICT(mod_id, name) DO UPDATE SET wins = wins + 1`,
);
const ladderLoss = sqlite.prepare(
  `INSERT INTO ladder (mod_id, name, wins, losses) VALUES (?, ?, 0, 1)
   ON CONFLICT(mod_id, name) DO UPDATE SET losses = losses + 1`,
);

function recordBattleOutcome(
  modId: string,
  config: BattleConfig,
  winner: string | null,
  attackerTeamId?: string,
  defenderTeamId?: string,
): void {
  // 约定：进攻方永远在 A 侧，防守方/Boss 在 B 侧（见战斗创建逻辑）
  const entries: Array<{ teamId?: string; side: string }> = [
    { teamId: attackerTeamId, side: 'A' },
    { teamId: defenderTeamId, side: 'B' },
  ];
  for (const { teamId, side } of entries) {
    if (!teamId) continue;
    const row = db.select().from(teams).where(eq(teams.id, teamId)).get();
    if (!row) continue;
    const isWin = winner === side;
    db.update(teams)
      .set({
        wins: row.wins + (isWin ? 1 : 0),
        losses: row.losses + (!isWin && winner !== null ? 1 : 0),
        inPoolAt: row.inPoolAt ?? now(),
      })
      .where(eq(teams.id, teamId))
      .run();
  }
  // 名字天梯（平局不计）。PVE 的 B 方是 Boss，不进名字天梯
  if (winner === null) return;
  for (const team of config.teams) {
    if (config.kind === 'pve' && team.side === 'B') continue;
    const won = team.side === winner;
    for (const u of team.units) {
      (won ? ladderWin : ladderLoss).run(modId, u.name);
    }
  }
}

// ---------- 路由 ----------

export function registerRoutes(app: FastifyInstance): void {
  app.setErrorHandler((err: Error & { statusCode?: number }, _req, reply) => {
    const status = err.statusCode ?? 400;
    reply.code(status < 400 ? 400 : status).send({ error: err.message });
  });

  app.get('/api/health', async () => ({ ok: true, time: now() }));

  // ---- 身份 ----

  app.post('/api/players', async (req) => {
    const body = req.body as { nickname?: string };
    const r = validateName(body.nickname ?? '');
    if (!r.ok) throw new Error(r.reason);
    return insertPlayer(r.name);
  });

  app.get('/api/me', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    return { token: player.token, nickname: player.nickname, discr: player.discr, displayName: displayName(player) };
  });

  app.patch('/api/me', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    const body = req.body as { nickname?: string };
    const r = validateName(body.nickname ?? '');
    if (!r.ok) throw new Error(r.reason);
    // 同名冲突则自动换编号
    for (let i = 0; i < 100; i++) {
      const discr = i === 0 ? player.discr : randomDiscr();
      try {
        const clash = db
          .select()
          .from(players)
          .where(and(eq(players.nickname, r.name), eq(players.discr, discr), ne(players.token, player.token)))
          .get();
        if (clash) continue;
        db.update(players).set({ nickname: r.name, discr }).where(eq(players.token, player.token)).run();
        return { token: player.token, nickname: r.name, discr, displayName: `${r.name}#${discr}` };
      } catch {
        // retry
      }
    }
    throw new Error('改名失败，请重试');
  });

  // ---- 模组 ----

  app.get('/api/mods', async () => {
    return MODS.map((m) => ({
      id: m.id,
      name: m.name,
      genKey: m.genKey,
      genVersion: m.genVersion,
      maxUnits: m.team.maxUnits,
      stats: m.stats,
      bosses:
        m.pveEnemies !== undefined
          ? [...BOSS_MAP.values()].map((b) => ({ id: b.id, name: b.name, title: b.title, desc: b.desc }))
          : undefined,
    }));
  });

  // ---- 队伍 ----

  app.post('/api/teams', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    const body = req.body as { modId?: string; members?: string[] };
    const mod = MODS.find((m) => m.id === body.modId);
    if (!mod) throw new Error('未知模组');
    const members = body.members ?? [];
    const names: { name: string; side: string }[] = [];
    for (const raw of members) {
      const r = validateName(raw ?? '');
      if (!r.ok) throw new Error(`队员名不合法：${r.reason}`);
      names.push({ name: r.name, side: 'A' });
    }
    const check = mod.team.validateTeam({ side: 'A', units: names });
    if (check) throw new Error(check);
    const row = {
      id: randomUUID(),
      ownerToken: player.token,
      modId: mod.id,
      membersJson: JSON.stringify(names.map((n) => ({ name: n.name }))),
      createdAt: now(),
      inPoolAt: null,
      wins: 0,
      losses: 0,
    };
    db.insert(teams).values(row).run();
    return parseTeam(row as typeof teams.$inferSelect);
  });

  app.get('/api/teams', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    const rows = db.select().from(teams).where(eq(teams.ownerToken, player.token)).all();
    return rows.map((row) => ({ ...parseTeam(row), mine: true }));
  });

  app.delete('/api/teams/:id', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    const { id } = req.params as { id: string };
    const row = db.select().from(teams).where(eq(teams.id, id)).get();
    if (!row || row.ownerToken !== player.token) throw new Error('队伍不存在');
    db.delete(teams).where(eq(teams.id, id)).run();
    return { ok: true };
  });

  // ---- 数据池 ----

  app.get('/api/pool', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    const q = req.query as { modId?: string; sort?: string; excludeMine?: string };
    if (!q.modId) throw new Error('缺少 modId');
    let rows = db
      .select()
      .from(teams)
      .where(and(eq(teams.modId, q.modId), isNotNull(teams.inPoolAt)))
      .all();
    if (q.excludeMine !== 'false') {
      rows = rows.filter((r) => r.ownerToken !== player.token);
    }
    const list = rows.map((row) => ({ ...parseTeam(row), mine: row.ownerToken === player.token }));
    if (q.sort === 'winrate') {
      list.sort((a, b) => {
        const ra = a.wins + a.losses > 0 ? a.wins / (a.wins + a.losses) : 0;
        const rb = b.wins + b.losses > 0 ? b.wins / (b.wins + b.losses) : 0;
        return rb - ra;
      });
    } else {
      list.sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1));
    }
    return list.slice(0, 100);
  });

  // ---- 战斗 ----

  app.post('/api/battles', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    const body = req.body as {
      kind?: 'async' | 'pve';
      modId?: string;
      attackerTeamId?: string;
      defenderTeamId?: string;
      bossId?: string;
    };
    const kind = body.kind ?? 'async';
    const mod = getMod(body.modId ?? '');
    const attacker = body.attackerTeamId
      ? db.select().from(teams).where(eq(teams.id, body.attackerTeamId)).get()
      : undefined;
    if (!attacker) throw new Error('进攻队伍不存在');
    if (attacker.ownerToken !== player.token) throw new Error('只能用自己的队伍进攻');

    let config: BattleConfig;
    if (kind === 'pve') {
      const bossId = body.bossId ?? '';
      const bossDef = BOSS_MAP.get(bossId);
      if (!bossDef) throw new Error('未知 Boss');
      config = {
        modId: mod.id,
        kind: 'pve',
        teams: [
          {
            side: 'A',
            units: (JSON.parse(attacker.membersJson) as { name: string }[]).map((m) => ({
              name: m.name,
              side: 'A',
              owner: displayName(player),
            })),
          },
          // B 方只放名字占位供战报展示，真正数值由规则集按 bossId 重建（DESIGN.md 7.9）
          { side: 'B', units: [{ name: bossDef.name, side: 'B', owner: '系统' }] },
        ],
        bossId,
      };
    } else {
      const defender = body.defenderTeamId
        ? db.select().from(teams).where(eq(teams.id, body.defenderTeamId)).get()
        : undefined;
      if (!defender) throw new Error('防守队伍不存在');
      if (defender.inPoolAt === null && defender.ownerToken !== player.token) {
        throw new Error('该队伍尚未入池，不能被挑战');
      }
      const defenderOwner = getPlayerByToken(defender.ownerToken);
      config = {
        modId: mod.id,
        kind: 'async',
        teams: [
          {
            side: 'A',
            units: (JSON.parse(attacker.membersJson) as { name: string }[]).map((m) => ({
              name: m.name,
              side: 'A',
              owner: displayName(player),
            })),
          },
          {
            side: 'B',
            units: (JSON.parse(defender.membersJson) as { name: string }[]).map((m) => ({
              name: m.name,
              side: 'B',
              owner: defenderOwner ? displayName(defenderOwner) : '未知',
            })),
          },
        ],
      };
    }

    const err = mod.team.validateTeams(config.teams);
    if (err) throw new Error(err);

    // 服务器即时模拟；entropy 取当前时间 → 结果不固定；配置+种子落库后可无限重演
    const record = createBattle(mod, config, Date.now());
    const id = randomUUID();
    db.insert(battles)
      .values({
        id,
        modId: mod.id,
        kind,
        configJson: JSON.stringify(record.config),
        seed: String(record.seed),
        winner: record.result.winner,
        rounds: record.result.rounds,
        reason: record.result.reason,
        createdAt: now(),
      })
      .run();

    const tx = sqlite.transaction(() => {
      recordBattleOutcome(mod.id, record.config, record.result.winner, attacker.id, body.defenderTeamId);
    });
    tx();

    return { id };
  });

  app.get('/api/battles', async (req) => {
    const q = req.query as { limit?: string };
    const limit = Math.min(100, Number(q.limit ?? 50));
    const rows = db.select().from(battles).orderBy(desc(battles.createdAt)).limit(limit).all();
    return rows.map((row) => {
      const config = JSON.parse(row.configJson) as BattleConfig;
      return {
        id: row.id,
        modId: row.modId,
        kind: row.kind,
        winner: row.winner,
        rounds: row.rounds,
        createdAt: row.createdAt,
        teams: config.teams.map((t) => ({
          side: t.side,
          names: t.units.map((u) => u.name),
          owner: t.units[0]?.owner ?? '',
        })),
      };
    });
  });

  app.get('/api/battles/:id', async (req) => {
    const { id } = req.params as { id: string };
    const row = db.select().from(battles).where(eq(battles.id, id)).get();
    if (!row) throw new Error('战报不存在');
    return {
      id: row.id,
      modId: row.modId,
      kind: row.kind,
      config: JSON.parse(row.configJson),
      seed: Number(row.seed),
      result: { winner: row.winner, rounds: row.rounds, reason: row.reason },
      createdAt: row.createdAt,
    };
  });

  // ---- 名字天梯 ----

  app.get('/api/ladder', async (req) => {
    const q = req.query as { modId?: string; min?: string };
    if (!q.modId) throw new Error('缺少 modId');
    const min = Math.max(0, Number(q.min ?? 5));
    const rows = db
      .select()
      .from(ladder)
      .where(
        and(
          eq(ladder.modId, q.modId),
          sql`(${ladder.wins} + ${ladder.losses}) >= ${min}`,
        ),
      )
      .all();
    return rows
      .map((r) => ({
        name: r.name,
        battles: r.wins + r.losses,
        wins: r.wins,
        losses: r.losses,
        winrate: r.wins + r.losses > 0 ? r.wins / (r.wins + r.losses) : 0,
      }))
      .sort((a, b) => b.winrate - a.winrate || b.battles - a.battles)
      .slice(0, 100);
  });
}
