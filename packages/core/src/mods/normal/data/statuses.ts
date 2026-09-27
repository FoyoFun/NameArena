import type { DerivedKey } from '../types';

/**
 * 状态（buff/debuff）数据表（DESIGN.md 7.5）。
 * 能力只引用状态 id；新增状态 = 在这里加一行。
 */
export interface StatusDef {
  id: string;
  name: string;
  kind: 'buff' | 'debuff';
  /** 乘法属性修正，如 { atk: 1.3 } */
  statMods?: Partial<Record<DerivedKey, number>>;
  /** 每回合结算：damage = 造成 power 点伤害；heal = 恢复 power 点 */
  dot?: 'damage' | 'heal';
  /** 硬控：跳过整个行动回合 */
  control?: 'stun';
  /** 护盾：power = 剩余吸收量 */
  shield?: boolean;
  defaultDuration: number;
  maxStacks: number;
  dispellable: boolean;
  desc: string;
}

export const STATUSES: StatusDef[] = [
  { id: 'poison', name: '中毒', kind: 'debuff', dot: 'damage', defaultDuration: 3, maxStacks: 1, dispellable: true, desc: '每回合受到毒素伤害' },
  { id: 'burn', name: '灼烧', kind: 'debuff', dot: 'damage', defaultDuration: 2, maxStacks: 1, dispellable: true, desc: '每回合受到灼烧伤害' },
  { id: 'stun', name: '眩晕', kind: 'debuff', control: 'stun', defaultDuration: 1, maxStacks: 1, dispellable: false, desc: '跳过一个行动回合' },
  { id: 'atkUp', name: '攻击上升', kind: 'buff', statMods: { atk: 1.3 }, defaultDuration: 3, maxStacks: 1, dispellable: true, desc: '攻击 +30%' },
  { id: 'atkDown', name: '攻击下降', kind: 'debuff', statMods: { atk: 0.7 }, defaultDuration: 3, maxStacks: 1, dispellable: true, desc: '攻击 −30%' },
  { id: 'defUp', name: '防御上升', kind: 'buff', statMods: { pdef: 1.4, mdef: 1.4 }, defaultDuration: 3, maxStacks: 1, dispellable: true, desc: '双防 +40%' },
  { id: 'defDown', name: '防御下降', kind: 'debuff', statMods: { pdef: 0.7, mdef: 0.7 }, defaultDuration: 3, maxStacks: 1, dispellable: true, desc: '双防 −30%' },
  { id: 'spdUp', name: '迅捷', kind: 'buff', statMods: { spd: 1.3 }, defaultDuration: 3, maxStacks: 1, dispellable: true, desc: '速度 +30%' },
  { id: 'spdDown', name: '迟缓', kind: 'debuff', statMods: { spd: 0.7 }, defaultDuration: 3, maxStacks: 1, dispellable: true, desc: '速度 −30%' },
  { id: 'shield', name: '护盾', kind: 'buff', shield: true, defaultDuration: 3, maxStacks: 1, dispellable: false, desc: '吸收伤害，耗尽或到期消失' },
  { id: 'regen', name: '再生', kind: 'buff', dot: 'heal', defaultDuration: 3, maxStacks: 1, dispellable: true, desc: '每回合恢复生命' },
];

export const STATUS_MAP = new Map(STATUSES.map((s) => [s.id, s]));
