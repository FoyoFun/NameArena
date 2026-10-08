/**
 * API 封装 + 匿名身份（token 存 localStorage，首次自动注册，DESIGN.md 5.6）。
 */

export interface Me {
  token: string;
  nickname: string;
  discr: string;
  displayName: string;
}

export interface TeamInfo {
  id: string;
  modId: string;
  members: string[];
  /** 每个成员的角色生成选项（fantasy：gender/jobId；未选择的成员为 null） */
  memberOpts: Array<Record<string, unknown> | null>;
  owner: string;
  mine: boolean;
  wins: number;
  losses: number;
  inPool: boolean;
  createdAt: string;
}

/** 队员提交形态：纯名字 或 名字+生成选项 */
export type MemberInput = string | { name: string; opts?: Record<string, unknown> };

export interface PveLadderRow {
  battleId: string;
  teamNames: string[];
  owner: string;
  win: boolean;
  actions: number;
  score: number;
  createdAt: string;
}

const TOKEN_KEY = 'namearena_token';
let me: Me | null = null;

export function getMe(): Me | null {
  return me;
}

async function request<T>(path: string, method: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {};
  if (me) headers['x-token'] = me.token;
  if (body !== undefined) headers['content-type'] = 'application/json';
  const resp = await fetch(path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = (await resp.json()) as T & { error?: string };
  if (!resp.ok) throw new Error(data.error ?? `请求失败（${resp.status}）`);
  return data;
}

/** 首次进入自动注册（App.vue 挂载时调用一次） */
export async function ensureMe(): Promise<Me> {
  if (me) return me;
  const saved = localStorage.getItem(TOKEN_KEY);
  if (saved) {
    // 临时带上 token 查询
    try {
      const resp = await fetch('/api/me', { headers: { 'x-token': saved } });
      if (resp.ok) {
        me = (await resp.json()) as Me;
        return me;
      }
    } catch {
      // 服务器不可用时落回注册（会被 401 拦住，不吞网络错误）
    }
  }
  const nickname = `玩家${Math.floor(1000 + Math.random() * 9000)}`;
  me = await request<Me>('/api/players', 'POST', { nickname });
  localStorage.setItem(TOKEN_KEY, me.token);
  return me;
}

export async function renameMe(nickname: string): Promise<Me> {
  me = await request<Me>('/api/me', 'PATCH', { nickname });
  localStorage.setItem(TOKEN_KEY, me.token);
  return me;
}

export const api = {
  mods: () => request<ModInfo[]>('/api/mods'),
  myTeams: () => request<TeamInfo[]>('/api/teams'),
  createTeam: (modId: string, members: MemberInput[]) => request<TeamInfo>('/api/teams', 'POST', { modId, members }),
  deleteTeam: (id: string) => request<{ ok: boolean }>(`/api/teams/${id}`, 'DELETE'),
  pool: (modId: string) => request<TeamInfo[]>(`/api/pool?modId=${encodeURIComponent(modId)}`),
  createBattle: (payload: {
    kind: 'async' | 'pve';
    modId: string;
    attackerTeamId: string;
    defenderTeamId?: string;
    bossId?: string;
  }) => request<{ id: string }>('/api/battles', 'POST', payload),
  /** 战报列表（决策 #65/#66）：服务器只返回与「我」有关、指定模式、3 天内的对局 */
  battles: (modId: string) => request<BattleListItem[]>(`/api/battles?modId=${encodeURIComponent(modId)}`),
  battle: (id: string) => request<BattleRecordDto>(`/api/battles/${id}`),
  ladder: (modId: string, min = 5) => request<LadderRow[]>(`/api/ladder?modId=${encodeURIComponent(modId)}&min=${min}`),
  pveLadder: (modId: string, bossId: string) =>
    request<PveLadderRow[]>(`/api/pve-ladder?modId=${encodeURIComponent(modId)}&bossId=${encodeURIComponent(bossId)}`),
};

export interface ModInfo {
  id: string;
  name: string;
  genKey: string;
  genVersion: number;
  maxUnits: number;
  stats: { id: string; label: string; show: 'bar' | 'pill' | 'hidden'; barMaxStat?: string; color?: string; desc?: string }[];
  bosses?: { id: string; name: string; title: string; desc: string }[];
}

export interface BattleListItem {
  id: string;
  modId: string;
  kind: string;
  winner: string | null;
  rounds: number;
  createdAt: string;
  teams: { side: string; names: string[]; owner: string }[];
}

export interface BattleRecordDto {
  id: string;
  modId: string;
  kind: string;
  config: {
    modId: string;
    kind: string;
    teams: { side: string; units: { name: string; side: string; owner?: string }[] }[];
    bossId?: string;
  };
  seed: number;
  result: { winner: string | null; rounds: number; reason: string };
  createdAt: string;
}

export interface LadderRow {
  name: string;
  battles: number;
  wins: number;
  losses: number;
  winrate: number;
}
