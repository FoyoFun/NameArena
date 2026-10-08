import { integer, primaryKey, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { uniqueIndex } from 'drizzle-orm/sqlite-core';

/** 数据模型（DESIGN.md 5.5）。建表用 raw SQL（db.ts），此处为 Drizzle 查询映射。 */

export const players = sqliteTable(
  'players',
  {
    token: text('token').primaryKey(),
    nickname: text('nickname').notNull(),
    discr: text('discr').notNull(),
    createdAt: text('created_at').notNull(),
    /** 最近一次带令牌请求的时刻（7 天未登录 → 清理其全部队伍，决策 #66） */
    lastSeenAt: text('last_seen_at'),
  },
  (t) => [uniqueIndex('players_nickname_discr').on(t.nickname, t.discr)],
);

export const teams = sqliteTable('teams', {
  id: text('id').primaryKey(),
  ownerToken: text('owner_token').notNull(),
  modId: text('mod_id').notNull(),
  membersJson: text('members_json').notNull(),
  createdAt: text('created_at').notNull(),
  /** 参与过任意一场战斗后入池（DESIGN.md 8.1） */
  inPoolAt: text('in_pool_at'),
  wins: integer('wins').notNull().default(0),
  losses: integer('losses').notNull().default(0),
});

export const battles = sqliteTable('battles', {
  id: text('id').primaryKey(),
  modId: text('mod_id').notNull(),
  kind: text('kind').notNull(), // async | pve | room
  configJson: text('config_json').notNull(),
  seed: text('seed').notNull(),
  winner: text('winner'),
  rounds: integer('rounds').notNull(),
  reason: text('reason').notNull().default(''),
  createdAt: text('created_at').notNull(),
  roomId: text('room_id'),
  /** 参战双方归属（战报只显示与自己有关的对局，决策 #65）；快斗/观战类为 NULL */
  attackerToken: text('attacker_token'),
  defenderToken: text('defender_token'),
});

export const ladder = sqliteTable(
  'ladder',
  {
    modId: text('mod_id').notNull(),
    name: text('name').notNull(),
    wins: integer('wins').notNull().default(0),
    losses: integer('losses').notNull().default(0),
  },
  (t) => [primaryKey({ columns: [t.modId, t.name] })],
);

/** PVE 讨伐记录（DESIGN-FANTASY.md §6.4 排行榜）：一次讨伐 = 一条记录 */
export const pveRecords = sqliteTable('pve_records', {
  id: text('id').primaryKey(),
  battleId: text('battle_id').notNull(),
  modId: text('mod_id').notNull(),
  bossId: text('boss_id').notNull(),
  /** 进攻方队伍快照（队伍可能被删，展示自足） */
  teamNames: text('team_names').notNull(),
  /** 进攻方队伍 id（讨伐榜只显示现存队伍的记录，决策 #67；存量行为 NULL，保留显示） */
  teamId: text('team_id'),
  owner: text('owner').notNull(),
  win: integer('win').notNull(),
  /** 行动数（计权后取整） */
  actions: integer('actions').notNull(),
  /** 己方分数 0~100 */
  score: integer('score').notNull(),
  createdAt: text('created_at').notNull(),
});
