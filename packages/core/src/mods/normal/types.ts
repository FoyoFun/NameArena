import type { BattleContext, UnitRuntime } from '../../engine';

// ---------- 六维与派生 ----------

export type StatId = 'str' | 'wis' | 'vit' | 'spr' | 'agi' | 'luk';
export type SixStats = Record<StatId, number>;
export const STAT_IDS: readonly StatId[] = ['str', 'wis', 'vit', 'spr', 'agi', 'luk'];

export const STAT_LABELS: Record<StatId, string> = {
  str: '力量',
  wis: '智慧',
  vit: '体力',
  spr: '精神',
  agi: '敏捷',
  luk: '幸运',
};

export type DerivedKey =
  | 'atk'
  | 'mag'
  | 'maxHp'
  | 'maxMp'
  | 'pdef'
  | 'mdef'
  | 'dodge'
  | 'crit'
  | 'critDmg'
  | 'spd';
export type DerivedStats = Record<DerivedKey, number>;

export interface Character {
  name: string;
  genVersion: number;
  base: SixStats;
  /** 每项属性命中的分布档位 id（UI 配色用） */
  tiers: Record<StatId, string>;
  /** 基础派生属性（未叠加被动修正） */
  derived: DerivedStats;
  abilities: CharacterAbility[];
  totalCost: number;
  personalityId: string;
}

export type AbilitySource = 'basic' | 'conditional' | 'random' | 'preset';
export interface CharacterAbility {
  id: string;
  source: AbilitySource;
}

// ---------- 能力 ----------

export type AbilityTag = 'attack' | 'heal' | 'buff' | 'control';

export type EffectSpec =
  | { type: 'damage'; kind: 'phys' | 'magic'; scale: number }
  | { type: 'heal'; scale: number }
  | {
      type: 'status';
      status: string;
      to: 'target' | 'self';
      duration: number;
      chance: number;
      /** 持续型/护盾类状态的强度系数（乘施法者 mag/spr） */
      powerScale?: number;
    };

export type TargetKind = 'enemy' | 'allEnemies' | 'ally' | 'allAllies' | 'self';

export interface ActiveSpec {
  mpCost: number;
  /** 冷却回合数，0 = 无冷却 */
  cooldown: number;
  target: TargetKind;
  effects: EffectSpec[];
}

export interface DamagePayload {
  amount: number;
  kind: 'phys' | 'magic';
  attacker: UnitRuntime;
  defender: UnitRuntime;
  crit: boolean;
}

/**
 * hook 契约（DESIGN.md 7.6）：起始清单，只加不改语义。
 * 每个hook都收到 hook 所属单位 unit（聚合时绑定）。
 * 铁律：hook 内必须确定性，随机只用 ctx.rng。
 */
export interface SkillCostPlan {
  mp: number;
  hp: number;
}

export interface NormalHooks {
  modifyActionCount(ctx: BattleContext, unit: UnitRuntime): number;
  modifySkillCost(ctx: BattleContext, unit: UnitRuntime, plan: SkillCostPlan): SkillCostPlan;
  modifyDamageCalc(ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): DamagePayload;
  onDealDamage(ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): void;
  onTakeDamage(ctx: BattleContext, unit: UnitRuntime, p: DamagePayload): void;
  onDodge(ctx: BattleContext, unit: UnitRuntime, p: { attacker: UnitRuntime; defender: UnitRuntime }): void;
  onKO(ctx: BattleContext, unit: UnitRuntime): void;
  modifyTargeting(ctx: BattleContext, unit: UnitRuntime, candidates: UnitRuntime[]): UnitRuntime[];
}

export type HookName = keyof NormalHooks;

export interface AbilityDef {
  id: string;
  name: string;
  kind: 'active' | 'passive';
  /** 伪预算权值：总 cost 越高，构造越可能结束（DESIGN.md 7.3） */
  cost: number;
  /** 抽取权重，默认 1 */
  weight: number;
  stackable: boolean;
  desc: string;
  /** AI 分类倾向；乘数受性格钳制 [0.7, 1.4]，任何类别永不禁用 */
  tags: AbilityTag[];
  active?: ActiveSpec;
  /** 被动：直接乘进派生属性（如 { atk: 1.12 }） */
  passiveStatMods?: Partial<Record<DerivedKey, number>>;
  hooks?: Partial<NormalHooks>;
  vfx?: string;
}

// ---------- Boss ----------

export interface BossDef {
  id: string;
  name: string;
  title: string;
  base: SixStats;
  abilityIds: string[];
  personalityId: string;
  desc: string;
}
