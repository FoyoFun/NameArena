import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from './schema';

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, '..', '..', 'data');
mkdirSync(dataDir, { recursive: true });

export const DB_PATH = join(dataDir, 'namearena.db');
const sqlite = new Database(DB_PATH);
sqlite.pragma('journal_mode = WAL');

// 建表（幂等）。小项目不做迁移工具，改表结构时删库重开即可（战报可重演，无珍贵数据）。
sqlite.exec(`
CREATE TABLE IF NOT EXISTS players (
  token TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  discr TEXT NOT NULL,
  created_at TEXT NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS players_nickname_discr ON players (nickname, discr);

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  owner_token TEXT NOT NULL,
  mod_id TEXT NOT NULL,
  members_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  in_pool_at TEXT,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS battles (
  id TEXT PRIMARY KEY,
  mod_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  config_json TEXT NOT NULL,
  seed TEXT NOT NULL,
  winner TEXT,
  rounds INTEGER NOT NULL,
  reason TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL,
  room_id TEXT
);

CREATE TABLE IF NOT EXISTS ladder (
  mod_id TEXT NOT NULL,
  name TEXT NOT NULL,
  wins INTEGER NOT NULL DEFAULT 0,
  losses INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (mod_id, name)
);

CREATE TABLE IF NOT EXISTS pve_records (
  id TEXT PRIMARY KEY,
  battle_id TEXT NOT NULL,
  mod_id TEXT NOT NULL,
  boss_id TEXT NOT NULL,
  team_names TEXT NOT NULL,
  owner TEXT NOT NULL,
  win INTEGER NOT NULL,
  actions INTEGER NOT NULL,
  score INTEGER NOT NULL,
  created_at TEXT NOT NULL
);
`);

// 增量加列（幂等）：建表 IF NOT EXISTS 不会给旧库补列，这里按 PRAGMA 逐列补齐
function ensureColumn(table: string, column: string, decl: string): void {
  const cols = sqlite.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!cols.some((c) => c.name === column)) {
    sqlite.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${decl}`);
  }
}

ensureColumn('players', 'last_seen_at', 'TEXT');
ensureColumn('battles', 'attacker_token', 'TEXT');
ensureColumn('battles', 'defender_token', 'TEXT');
ensureColumn('pve_records', 'team_id', 'TEXT');

// 存量玩家的活跃时间回填为「本次部署时刻」→ 一律获得 7 天宽限，避免升级瞬间误删现役队伍
const backfill = sqlite.prepare(
  `UPDATE players SET last_seen_at = ? WHERE last_seen_at IS NULL`,
);
const backfilled = backfill.run(new Date().toISOString());
if (backfilled.changes > 0) {
  console.log(`[db] last_seen_at 回填 ${backfilled.changes} 名存量玩家（7 天宽限）`);
}

export const db = drizzle(sqlite, { schema });
export { sqlite };
