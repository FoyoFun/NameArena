import type { Rng } from '../name-gen';

// ---------- 表现层契约 ----------

export interface StatMeta {
  id: string;
  label: string;
  /** UnitCard 的展示方式：bar=进度条，pill=数值徽章，hidden=不展示 */
  show: 'bar' | 'pill' | 'hidden';
  /** bar 最大值（如 maxHp）或格式化提示 */
  barMaxStat?: string;
  color?: string;
  desc?: string;
}

/** 事件附带的表现描述（纯数据）。模组"点菜"，框架负责渲染。 */
export interface PresentSpec {
  /** VFX 注册表中的特效 id */
  vfx?: string;
  /** 作用对象："unit:<uid>" | "stage" | "side:<side>" */
  target?: string;
  /** 播放节奏提示（毫秒），Sequencer 据此推进时间轴 */
  durationMs?: number;
  /** 文字战报片段（文案归模组） */
  logText?: string;
}

export type BattleEventType =
  | 'battleStart'
  | 'roundStart'
  | 'actionStart'
  | 'skillUse'
  | 'miss'
  | 'damage'
  | 'heal'
  | 'statusApply'
  | 'statusRemove'
  | 'statChange'
  | 'unitDown'
  | 'roundEnd'
  | 'battleEnd'
  | 'log';

export interface BattleEvent {
  seq: number;
  type: BattleEventType;
  payload: Record<string, unknown>;
  present: PresentSpec[];
}

// ---------- 战斗配置与状态 ----------

export interface UnitConfig {
  /** 队员名字（名字派生型单位）；Boss 等固定单位由模组自行解释 */
  name: string;
  side: string;
  /** 展示用所属者（昵称#编号），仅展示 */
  owner?: string;
}

export interface TeamConfig {
  side: string;
  units: UnitConfig[];
}

export interface BattleConfig {
  modId: string;
  kind: 'async' | 'room' | 'pve';
  teams: TeamConfig[];
  /** PVE 时的 Boss 定义 id（解释权归模组） */
  bossId?: string;
}

export interface BattleResult {
  winner: string | null;
  rounds: number;
  /** 胜负原因：'wipe'（全灭）| 'attrition'（回合上限判定）| 'draw' 等，模组自定 */
  reason: string;
}

export interface StatusInstance {
  id: string;
  /** 剩余持续回合 */
  remain: number;
  /** 强度（如 DoT 每跳伤害、护盾吸收量），解释权归模组 */
  power: number;
}

export interface UnitRuntime {
  uid: string;
  side: string;
  name: string;
  /** 模组自定义角色数据（普通单位为名字生成的角色，Boss 为固定定义） */
  char: unknown;
  alive: boolean;
  /** 模组管理的当前数值（hp/mp/atk/…），键为模组定义的 stat id */
  stats: Record<string, number>;
  statuses: StatusInstance[];
  /** 模组便签（性格、冷却、hook 列表、每侧输出统计…） */
  meta: Record<string, unknown>;
}

export interface BattleState {
  round: number;
  units: UnitRuntime[];
  over: boolean;
  winner: string | null;
  scratch: Record<string, unknown>;
}

// ---------- 模组契约（DESIGN.md 6.1） ----------

export interface GenOptions {
  name: string;
}

export interface TeamRule {
  maxUnits: number;
  /** 单队校验（建队时用） */
  validateTeam(team: TeamConfig): string | null;
  /** 战斗级校验（开战时用，如要求双方齐备） */
  validateTeams(teams: TeamConfig[]): string | null;
}

/**
 * 框架/模组三句契约：
 * 框架管"名字→种子"，模组管"种子→角色"；
 * 框架管"种子供给与录像"，模组管"怎么用种子打仗"；
 * 框架管"事件→表现"，模组管"表现要什么"。
 */
export interface Mod {
  id: string;
  name: string;
  /**
   * 生成域：进入角色种子的固定值（DESIGN.md 决策 #26）。
   * 同一生成域的模组（如 常规PVP/常规PVE）同名必出同角色；
   * 不同生成域（如 将来的 FF14）互不影响。不再使用模组 id。
   */
  genKey: string;
  genVersion: number;
  /** 数值体系元数据：有哪些数值、UnitCard 怎么展示 */
  stats: StatMeta[];
  /** 名字 → 角色（模组内自行取种子，通常用 nameSeed(name, genKey, genVersion)） */
  generateCharacter(rng: Rng, opts: GenOptions): unknown;
  rules: Ruleset;
  team: TeamRule;
  /** PVE 实例：按 bossId 产出固定敌方单位 */
  pveEnemies?: (bossId: string) => UnitConfig[];
}

export interface Ruleset {
  initBattle(ctx: BattleContext): void;
  /** 推进一个行动（引擎循环调用直到 isOver） */
  nextAction(ctx: BattleContext): void;
  isOver(state: BattleState): boolean;
}

export interface BattleContext {
  config: BattleConfig;
  state: BattleState;
  rng: Rng;
  emit(type: BattleEventType, payload?: Record<string, unknown>, present?: PresentSpec[]): void;
}

export interface BattleRecord {
  config: BattleConfig;
  seed: number;
  result: BattleResult;
}
