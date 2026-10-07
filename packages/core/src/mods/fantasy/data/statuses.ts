import type { CombatKey, SkillLabel } from '../types';

/**
 * 状态数据表（DESIGN-FANTASY.md §5.4，F5 裁定三种时长类型）。
 * 同 id 多实例并存（不同来源独立结算）；易伤按实例数计层。
 * statMods 为乘区比例修正（+0.3 = +30%），进 (基础+Σ固定)×(1+Σ比例) 公式（F25）。
 */
export interface FStatusDef {
  id: string;
  name: string;
  kind: 'buff' | 'debuff';
  label?: SkillLabel;
  /** fixed=固定回合；resist=异常滚动型（难度随回合递减）；absorb=增益滚动型（难度随回合递增） */
  durationType: 'fixed' | 'resist' | 'absorb';
  /** 控制类：持有期间跳过主动行动 */
  control?: boolean;
  /** 每个自身回合的 tick 结算 */
  dot?: 'damage' | 'heal';
  /** flat: 扣实例 power 点；pctCurrent: 扣当前 HP × pct */
  dotKind?: 'flat' | 'pctCurrent';
  pct?: number;
  statMods?: Partial<Record<CombatKey, number>>;
  /** 易伤：每实例受伤 +FORMULAS.vulnerablePerStack */
  vulnerable?: boolean;
  defaultDuration: number;
  desc: string;
}

export const STATUSES: FStatusDef[] = [
  { id: 'poison', name: '中毒', kind: 'debuff', label: 'phys', durationType: 'resist', dot: 'damage', dotKind: 'flat', defaultDuration: 0, desc: '每回合受到固定毒素伤害，可抵抗' },
  { id: 'bleed', name: '流血', kind: 'debuff', label: 'phys', durationType: 'resist', dot: 'damage', dotKind: 'pctCurrent', pct: 0.04, defaultDuration: 0, desc: '每回合流失当前生命的百分比，可抵抗' },
  { id: 'burn', name: '灼烧', kind: 'debuff', label: 'magic', durationType: 'resist', dot: 'damage', dotKind: 'flat', defaultDuration: 0, desc: '每回合受到固定灼烧伤害，可抵抗' },
  { id: 'freeze', name: '冰冻', kind: 'debuff', label: 'magic', durationType: 'fixed', control: true, defaultDuration: 1, desc: '被冻结一回合无法行动' },
  { id: 'stun', name: '眩晕', kind: 'debuff', label: 'common', durationType: 'fixed', control: true, defaultDuration: 1, desc: '被眩晕一回合无法行动' },
  { id: 'faint', name: '昏厥', kind: 'debuff', label: 'common', durationType: 'resist', control: true, defaultDuration: 0, desc: '直到抵抗成功前无法行动，抵抗越来越容易' },
  { id: 'vulnerable', name: '易伤', kind: 'debuff', label: 'common', durationType: 'resist', vulnerable: true, defaultDuration: 0, desc: '每层受到的伤害增加' },
  { id: 'atkDown', name: '攻击降低', kind: 'debuff', durationType: 'resist', statMods: { atk: -0.3 }, defaultDuration: 0, desc: '攻击 −30%，可抵抗' },
  { id: 'defDown', name: '防御降低', kind: 'debuff', durationType: 'resist', statMods: { def: -0.3 }, defaultDuration: 0, desc: '防御 −30%，可抵抗' },
  { id: 'spdDown', name: '速度降低', kind: 'debuff', durationType: 'resist', statMods: { spd: -0.3 }, defaultDuration: 0, desc: '速度 −30%，可抵抗' },
  { id: 'atkUp', name: '攻击提升', kind: 'buff', durationType: 'absorb', statMods: { atk: 0.3 }, defaultDuration: 0, desc: '攻击 +30%，靠吸收判定维持' },
  { id: 'defUp', name: '防御提升', kind: 'buff', durationType: 'absorb', statMods: { def: 0.3 }, defaultDuration: 0, desc: '防御 +30%，靠吸收判定维持' },
  { id: 'spdUp', name: '速度提升', kind: 'buff', durationType: 'absorb', statMods: { spd: 0.3 }, defaultDuration: 0, desc: '速度 +30%，靠吸收判定维持' },
  { id: 'regen', name: '回春', kind: 'buff', durationType: 'absorb', dot: 'heal', dotKind: 'flat', defaultDuration: 0, desc: '每回合恢复生命，靠吸收判定维持' },
];

export const STATUS_MAP = new Map(STATUSES.map((s) => [s.id, s]));

/** 随机增益池（祝福/战歌/舞娘/药理·正面） */
export const RANDOM_BUFF_POOL = ['atkUp', 'defUp', 'spdUp', 'regen'];
/** 随机负面池（药理·负面） */
export const RANDOM_DEBUFF_POOL = ['poison', 'bleed', 'atkDown', 'defDown'];
