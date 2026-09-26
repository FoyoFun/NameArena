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
