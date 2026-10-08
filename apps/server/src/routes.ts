import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { and, desc, eq, isNotNull, ne, sql } from 'drizzle-orm';
import { battleSeed, createBattle, getMod, MODS, simulate, validateName } from '@namearena/core';
import type { BattleConfig } from '@namearena/core';
import { db, sqlite } from './db/db';
import { battles, ladder, players, pveRecords, teams } from './db/schema';

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

/** 活跃时间的写放大节流：距上次记录超过 1 小时才落库（判定 7 天未登录足够精确） */
const LAST_SEEN_THROTTLE_MS = 3600_000;

function requirePlayer(req: FastifyRequest, reply: FastifyReply) {
  const token = req.headers['x-token'] as string | undefined;
  const player = getPlayerByToken(token);
  if (!player) {
    reply.code(401).send({ error: '需要有效的身份令牌（请刷新页面重新注册）' });
    return null;
  }
  const t = now();
  if (!player.lastSeenAt || (t > player.lastSeenAt && Date.parse(t) - Date.parse(player.lastSeenAt) > LAST_SEEN_THROTTLE_MS)) {
    db.update(players).set({ lastSeenAt: t }).where(eq(players.token, player.token)).run();
  }
  return player;
}

/** members_json 的存储结构：名字 + 可选生成选项（性别/职业等，模组自解释） */
interface MemberJson {
  name: string;
  opts?: Record<string, unknown>;
}

function attackerMembers(row: typeof teams.$inferSelect): MemberJson[] {
  return JSON.parse(row.membersJson) as MemberJson[];
}

function parseTeam(row: typeof teams.$inferSelect) {
  const owner = getPlayerByToken(row.ownerToken);
  const members = JSON.parse(row.membersJson) as MemberJson[];
  return {
    id: row.id,
    modId: row.modId,
    members: members.map((m) => m.name),
    memberOpts: members.map((m) => m.opts ?? null),
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
      bosses: m.pveEnemies !== undefined ? (m.pveBosses?.() ?? []) : undefined,
    }));
  });

  // ---- 队伍 ----

  app.post('/api/teams', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    // 成员可以是纯名字字符串，也可以是 { name, gender?, jobId? }（角色生成选项）
    const body = req.body as { modId?: string; members?: Array<string | { name?: string; opts?: Record<string, unknown> }> };
    const mod = MODS.find((m) => m.id === body.modId);
    if (!mod) throw new Error('未知模组');
    const members = body.members ?? [];
    const units: { name: string; side: string; opts?: Record<string, unknown> }[] = [];
    for (const raw of members) {
      const name = typeof raw === 'string' ? raw : (raw?.name ?? '');
      const opts = typeof raw === 'string' ? undefined : raw?.opts;
      const r = validateName(name ?? '');
      if (!r.ok) throw new Error(`队员名不合法：${r.reason}`);
      const optErr = mod.validateGenOpts?.(opts);
      if (optErr) throw new Error(optErr);
      units.push({ name: r.name, side: 'A', opts });
    }
    const check = mod.team.validateTeam({ side: 'A', units });
    if (check) throw new Error(check);
    const row = {
      id: randomUUID(),
      ownerToken: player.token,
      modId: mod.id,
      membersJson: JSON.stringify(units.map((u) => (u.opts ? { name: u.name, opts: u.opts } : { name: u.name }))),
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
      const brief = mod.pveBosses?.().find((b) => b.id === bossId);
      if (!brief) throw new Error('未知 Boss');
      config = {
        modId: mod.id,
        kind: 'pve',
        teams: [
          {
            side: 'A',
            units: attackerMembers(attacker).map((m) => ({
              name: m.name,
              side: 'A',
              owner: displayName(player),
              opts: m.opts,
            })),
          },
          { side: 'B', units: [{ name: brief.name, side: 'B', owner: '系统' }] },
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
            units: attackerMembers(attacker).map((m) => ({
              name: m.name,
              side: 'A',
              owner: displayName(player),
              opts: m.opts,
            })),
          },
          {
            side: 'B',
            units: attackerMembers(defender).map((m) => ({
              name: m.name,
              side: 'B',
              owner: defenderOwner ? displayName(defenderOwner) : '未知',
              opts: m.opts,
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
    // 参战方归属落库（决策 #65）：战报列表按 token 过滤「与我有关」，改名也不失配
    const defenderToken = kind === 'pve' ? null : (body.defenderTeamId
      ? db.select({ t: teams.ownerToken }).from(teams).where(eq(teams.id, body.defenderTeamId)).get()?.t ?? null
      : null);
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
        attackerToken: player.token,
        defenderToken,
      })
      .run();

    // PVE 讨伐记录（排行榜用，DESIGN-FANTASY.md §6.4）。需要 scores → 补一次本地模拟取状态
    if (kind === 'pve') {
      const { state } = simulate(mod, config, record.seed);
      const scores = state.scratch['scores'] as Record<string, number> | undefined;
      db.insert(pveRecords)
        .values({
          id: randomUUID(),
          battleId: id,
          modId: mod.id,
          bossId: body.bossId ?? '',
          teamNames: JSON.stringify(config.teams[0]!.units.map((u) => u.name)),
          teamId: attacker.id,
          owner: displayName(player),
          win: record.result.winner === 'A' ? 1 : 0,
          actions: record.result.rounds,
          score: Math.round(scores?.['A'] ?? 0),
          createdAt: now(),
        })
        .run();
    }

    const tx = sqlite.transaction(() => {
      recordBattleOutcome(mod.id, record.config, record.result.winner, attacker.id, body.defenderTeamId);
    });
    tx();

    return { id };
  });

  // 战报列表（决策 #65/#66）：只显示「与我有关」（进攻或防守方是自己）且属于指定模式的
  // 对局，保留 3 天（过期行由 maintenance 清扫物理删除，这里只做查询过滤）
  const REPORT_TTL_MS = 3 * 24 * 3600_000;

  app.get('/api/battles', async (req, reply) => {
    const player = requirePlayer(req, reply);
    if (!player) return;
    const q = req.query as { modId?: string; limit?: string };
    if (!q.modId) throw new Error('缺少 modId');
    const cutoff = new Date(Date.now() - REPORT_TTL_MS).toISOString();
    const limit = Math.min(200, Number(q.limit ?? 100));
    const rows = db
      .select()
      .from(battles)
      .where(
        and(
          eq(battles.modId, q.modId),
          sql`${battles.createdAt} >= ${cutoff}`,
          sql`(${battles.attackerToken} = ${player.token} OR ${battles.defenderToken} = ${player.token})`,
        ),
      )
      .orderBy(desc(battles.createdAt))
      .limit(limit)
      .all();
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

  /** 生成域（同名同角色域）：fantasy-pvp / fantasy-pve → fantasy */
  function genDomainOf(modId: string): string {
    return modId.replace(/-(pvp|pve)$/, '');
  }

  /** 当前生成域（如 fantasy，pvp/pve 互通）下仍存在的队伍所含名字集合。
   *  天梯条目只有名字还在某支现存队伍里才展示（决策 #67）；不物理删除，
   *  重建同名队伍后历史战绩自动恢复。 */
  function liveTeamNames(genDomain: string): Set<string> {
    const rows = db.select({ modId: teams.modId, membersJson: teams.membersJson }).from(teams).all();
    const names = new Set<string>();
    for (const r of rows) {
      if (genDomainOf(r.modId) !== genDomain) continue;
      for (const m of JSON.parse(r.membersJson) as MemberJson[]) names.add(m.name);
    }
    return names;
  }

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
    const live = liveTeamNames(genDomainOf(q.modId));
    return rows
      .filter((r) => live.has(r.name))
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

  // ---- PVE 讨伐榜（DESIGN-FANTASY.md §6.4）----
  // 排序：胜利 > 失败；胜利内行动数少者高 → 己方分数高者高；失败内行动数多者高（撑得久）→ 己方分数高者高（虽败犹荣）

  app.get('/api/pve-ladder', async (req) => {
    const q = req.query as { modId?: string; bossId?: string; limit?: string };
    if (!q.modId) throw new Error('缺少 modId');
    if (!q.bossId) throw new Error('缺少 bossId');
    const limit = Math.min(100, Number(q.limit ?? 50));
    const rows = db
      .select()
      .from(pveRecords)
      .where(and(eq(pveRecords.modId, q.modId), eq(pveRecords.bossId, q.bossId)))
      .all();
    // 只显示现存队伍的记录（决策 #67）；team_id 为 NULL 的存量行无从归属，保留显示
    const liveTeamIds = new Set(db.select({ id: teams.id }).from(teams).all().map((r) => r.id));
    return rows
      .filter((r) => r.teamId === null || liveTeamIds.has(r.teamId))
      .map((r) => ({
        battleId: r.battleId,
        teamNames: JSON.parse(r.teamNames) as string[],
        owner: r.owner,
        win: r.win === 1,
        actions: r.actions,
        score: r.score,
        createdAt: r.createdAt,
      }))
      .sort((a, b) => {
        if (a.win !== b.win) return a.win ? -1 : 1;
        if (a.actions !== b.actions) return a.win ? a.actions - b.actions : b.actions - a.actions;
        return b.score - a.score;
      })
      .slice(0, limit);
  });
}
