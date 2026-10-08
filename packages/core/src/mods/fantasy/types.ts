import type { BattleContext, UnitRuntime } from '../../engine';

// ---------- 六维与派生 ----------

export type BaseStatId = 'str' | 'vit' | 'int' | 'spr' | 'agi' | 'luk';
export type SixStats = Record<BaseStatId, number>;
export const BASE_STAT_IDS: readonly BaseStatId[] = ['str', 'vit', 'int', 'spr', 'agi', 'luk'];

export const BASE_STAT_LABELS: Record<BaseStatId, string> = {
  str: '力量',
  vit: '体质',
  int: '智力',
  spr: '精神',
  agi: '敏捷',
  luk: '幸运',
};

/** 十二战斗属性（仇恨 hate 单列：只由职业决定，不吃任何修正）。百分比属性以小数存储。 */
export type CombatKey =
  | 'atk'
  | 'def'
  | 'spd'
  | 'maxHp'
  | 'crit'
  | 'hit'
  | 'dodge'
  | 'resist'
  | 'absorb'
  | 'destiny'
  | 'ailment';

export type DerivedStats = Record<CombatKey, number>;

export const COMBAT_LABELS: Record<CombatKey, string> = {
  atk: '攻击',
  def: '防御',
  spd: '速度',
  maxHp: 'HP',
  crit: '暴击率',
  hit: '命中率',
  dodge: '闪避率',
  resist: '抵抗率',
  absorb: '吸收率',
  destiny: '天选值',
  ailment: '异常率',
};

// ---------- 职业与性别 ----------

/** 全部 11 职业（二期 v2 起全部进入随机池） */
export type JobId =
  | 'knight'
  | 'warrior'
  | 'swordsman'
  | 'grappler'
  | 'assassin'
  | 'hunter'
  | 'bard'
  | 'dancer'
  | 'blackmage'
  | 'apothecary'
  | 'whitemage';
export type Gender = 'male' | 'female';

export const GENDER_LABELS: Record<Gender, string> = { male: '男', female: '女' };

export interface Character {
  name: string;
  genVersion: number;
  gender: Gender;
  jobId: JobId;
  base: SixStats;
  /** 每项属性命中的分布档位 id（UI 配色用） */
  tiers: Record<BaseStatId, string>;
  /** 六维映射 + 职业补正后的派生（技能均为机制系，无静态属性被动） */
  derived: DerivedStats;
  skills: CharacterSkill[];
  totalCost: number;
}

export type SkillSource = 'job' | 'pool';
export interface CharacterSkill {
  id: string;
  source: SkillSource;
}

// ---------- 技能 ----------

export type SkillLabel = 'phys' | 'magic' | 'common';
export const SKILL_LABEL_TEXT: Record<SkillLabel, string> = { phys: '物理', magic: '魔法', common: '通用' };

export interface DamageEffect {
  type: 'damage';
  scale: number;
  /**
   * 多段追击模型（F48 起默认规则）：每段后以 p 概率追击下一段，最多 max 段。缺省=单段。
   * 铁律（主人裁定）：今后一切多 Hit 技能，每段 Hit 都**独立结算**命中、暴击、
   * 骑士被动减伤等一切逐伤害判定，除非特殊说明。
   */
  chase?: {
    p: number;
    max: number;
    /** 追击概率的天选影响缩放（<1 削弱天选对该 roll 的影响；主人裁定：连击段数少受天选摆布） */
    ptScale?: number;
  };
}
export interface HealEffect {
  type: 'heal';
  scale: number;
  /** 触发概率（缺省 1 必定发生；药师危险实验等概率型治疗用） */
  chance?: number;
  /** 缺省按主动技 target 解析；'self' 强制治疗施法者自己（药师危险实验用） */
  to?: 'self';
}
export interface StatusEffect {
  type: 'status';
  status: string;
  /** 命中后从池中随机取一个状态施加（如 刺客：中毒或流血；祝福：随机增益） */
  pool?: string[];
  /** 技能基础概率；给敌人的负面最终概率 = 软上限压缩(基础 + 异常率×ailmentScale + 天选pt)（F38/F39） */
  chance: number;
  /** 人物异常率对该技能的影响系数：硬控（眩晕/冰冻）低、挂异常专精技高。缺省 1 */
  ailmentScale?: number;
  to?: 'target' | 'self';
  /** 固定量 DoT 的强度 = 施加者攻击 × powerScaleAtk（中毒/灼烧/回春） */
  powerScaleAtk?: number;
  /** 流血：每跳扣除目标当前 HP 的比例 */
  pct?: number;
}
export interface SummonEffect {
  type: 'summon';
  pet: string;
}
export type SkillEffect = DamageEffect | HealEffect | StatusEffect | SummonEffect;

export interface ActiveSpec {
  target: 'enemy' | 'allyInjured' | 'ally' | 'self';
  /** 吟唱：标称时长 = base + roll(0~rollMax)（每次发动 roll，F6/Q7） */
  cast?: { base: number; rollMax: number };
  /** 黑魔导型：伤害倍率随实际吟唱耗时增长（scale + 实际tick/castDivisor × castScale） */
  castDivisor?: number;
  castScale?: number;
  /** 造成伤害的一部分转为自身生命（吸血） */
  drainRatio?: number;
  /**
   * 召唤技的一次性补偿（F51）：本场该技能已召唤过时，技能改为一次普通伤害打击。
   * 只配在明确要求的技能上（如猎人呼唤猎犬）；未配置时已用过就只走 summonPet 的失败提示。
   */
  summonFallback?: { scale: number };
  effects: SkillEffect[];
}

export interface DamagePayload {
  amount: number;
  attacker: UnitRuntime;
  defender: UnitRuntime;
  crit: boolean;
  /** 来源技能名（反击/DoT 等标记用） */
  source?: string;
  viaCast?: boolean;
}

/**
 * 被动 hook 契约（起始清单，只加不改语义）。
 * 铁律：hook 内必须确定性，随机只用 ctx.rng；一切"概率"过 favor() 吃天选加成。
 */
export interface FantasyHooks {
  /** 受到伤害判定前，可改写伤害（骑士铁壁誓约） */
  modifyIncomingDamage?(ctx: BattleContext, self: UnitRuntime, amount: number, attacker: UnitRuntime): number;
  /** 自己造成直接伤害后（战士吸血/诗人战歌/药理/白魔圣光/猎印记） */
  onDealtDamage?(ctx: BattleContext, self: UnitRuntime, p: DamagePayload): void;
  /** 自己受到直接伤害后（剑士反击） */
  onTakenDamage?(ctx: BattleContext, self: UnitRuntime, p: DamagePayload): void;
  /** 上增益成功后（舞娘双重舞步） */
  onBuffApplied?(ctx: BattleContext, self: UnitRuntime, target: UnitRuntime, statusId: string): void;
  /** 自己完成治疗后（药理·正面） */
  onHealDone?(ctx: BattleContext, self: UnitRuntime, target: UnitRuntime, amount: number): void;
  /** 发起直接伤害时的输出修正（黑魔积蓄；刺客弱点洞悉按目标异常数增伤） */
  modifyDamageOut?(ctx: BattleContext, self: UnitRuntime, amount: number, defender: UnitRuntime): number;
  /** 索敌时询问：本次是否改用反仇恨权重（刺客猎杀直觉） */
  useInverseTargeting?(ctx: BattleContext, self: UnitRuntime): boolean;
  /** 回合内追加行动次数 roll（二连击），每次追加计 0.8×单位权重 */
  extraActions?(ctx: BattleContext, self: UnitRuntime): number;
  /** 发起吟唱时 roll：true = 免吟唱立即发动（迅咏） */
  skipCast?(ctx: BattleContext, self: UnitRuntime): boolean;
  /** 死亡时的复活概率（不死鸟之志）；引擎逐个 roll，任一成功即以 1 HP 复活 */
  reviveChance?(ctx: BattleContext, self: UnitRuntime): number;
}

export interface SkillDef {
  id: string;
  name: string;
  kind: 'active' | 'passive';
  /** 异常标签（物理/魔法/通用），纯机制技能可缺省 */
  label?: SkillLabel;
  /** 伪预算 cost（抽取用） */
  cost: number;
  /** 抽取权重；0 = 不入池（职业技能、宠物技能） */
  weight: number;
  desc: string;
  vfx?: string;
  active?: ActiveSpec;
  passive?: FantasyHooks;
}

// ---------- 召唤物 ----------

export interface PetDef {
  id: string;
  name: string;
  /** 派生自召唤者快照的乘区 */
  derive: Partial<Record<'atk' | 'def' | 'spd' | 'maxHp', number>>;
  /** 固定附加属性（小数=百分比属性） */
  fixed: Partial<Record<CombatKey, number>>;
  /** 仇恨（×1000 整数，与职业表同制） */
  hate: number;
  skills: string[];
}
