/**
 * 幻想大乱斗 全部公式系数（DESIGN-FANTASY.md §4/§5/§6）。
 * 集中于此 + 各 data 表；改必跑批量模拟（scripts/sim）。钳制上下限全部进本表（F26：主人可配）。
 */
export const FORMULAS = {
  // ---------- 连续映射（§3.2） ----------
  /** 高端次线性放大：wHigh 超过 1 后按 √(x−90) × 系数增长 */
  wHighSqrtCoef: 0.1,
  /** 低端深渊放大：x<10 后每点 × 系数 */
  wLowAbyssCoef: 0.03,

  // ---------- 天选（§4.2） ----------
  /** 天选加成 pt = destinyAmp × 天选/(天选+destinyB) */
  destinyAmp: 0.3,
  destinyB: 200,
  /**
   * 天选突破系数（主人裁定 F44）：天选除了影响原始成功率外，还能突破概率上限——
   * 钳制/软上限截断后，再按 pt × 此系数补足（封顶 100%）。
   * 作用于命中（突破 90% 上限）、抵抗/吸收（突破 95%）、闪避（守方自身闪避上限 80%→更高）、一切 favor 判定。
   */
  destinyBreakCoef: 0.5,
  /**
   * 异常的 80~100% 区间天选更容易影响（主人裁定 F44）：异常在软上限压缩后按
   * pt × ailmentBreakCoef（大于普通突破系数）再补足，使高天选角色能把异常推向 100%。
   */
  ailmentBreakCoef: 1.5,

  // ---------- 命中（§4.2） ----------
  /** 命中概率 = clamp(hitBase + 攻hit − 守dodge + 攻天选pt − 守天选pt, hitFloor, hitCap)
   *  主人裁定：闪避再高也不能 100% 闪避、命中再低也不会 0% —— hitFloor=15% 是铁底 */
  hitBase: 0.6,
  hitFloor: 0.15,
  hitCap: 0.9,

  // ---------- 属性钳制（Q27：上下限全进配置表） ----------
  clamp: {
    dodge: { min: 0.02, max: 0.8 },
    hit: { min: 0.02, max: 0.8 },
    crit: { min: 0.02, max: 1.0 },
    resist: { min: 0.02, max: 1.0 },
    absorb: { min: 0.02, max: 1.0 },
    ailment: { min: -0.6, max: 1.0 },
    spd: { min: 60, max: 400 },
  },

  // ---------- 伤害与治疗（§4.3） ----------
  varianceMin: 0.9,
  varianceMax: 1.1,
  /** 暴击固定倍率（F22：无暴伤概念） */
  critMult: 1.6,
  minDamage: 1,
  /** 易伤每实例（层）受伤增幅 */
  vulnerablePerStack: 0.25,
  /**
   * 乱战规模加成：直接伤害 ×(1 + 系数×(双方初始单位合计−2))。
   * 平衡旋钮：让大队伍战斗按人数比例加速收尾（1v1 不受影响），使
   * "1v1≈15 行动 / 5v5≈70 行动"的时长目标可用全局旋钮同时达成。
   */
  meleeSizeBonus: 0.07,

  // ---------- 状态滚动（§5.4） ----------
  /**
   * 异常施加软上限（主人裁定）：原始概率 ≤ 此值时原样生效；超过后双曲压缩，
   * 80% 上下轻轻松松、100% 极为困难（raw 4.6 才到 99%）。只作用于给敌人的负面状态。
   */
  ailmentSoftCap: 0.8,
  /** resist 型：成功率 = clamp(抵抗率 + 天选pt + 已存在回合 × 递增, 0, cap)——难度随回合递减 */
  resistGainPerTurn: 0.08,
  resistCap: 0.95,
  /** absorb 型：成功率 = clamp(吸收率 + 天选pt − 已存在回合 × 递减, floor, cap)——难度随回合递增 */
  absorbDecayPerTurn: 0.05,
  absorbFloor: 0.05,
  absorbCap: 0.95,

  // ---------- 仇恨索敌（§5.3） ----------
  hateGamma: 2,

  // ---------- ATB 与行动时钟（§5.1/§6） ----------
  atbMax: 1000,
  /** 开局 ATB 随机起点（节奏打散，确定性由种子保证） */
  atbStartMax: 250,
  /** 场上最大单位数（双方合计，含召唤） */
  maxUnitsOnField: 24,
  /** 多动追加上限（每回合最多追加次数，防无限） */
  maxExtraActions: 2,
  extraActionWeight: 0.8,
  /** 召唤物行动权重 */
  summonWeight: 0.5,
  /** PVP 行动数封顶 = 双方初始在场单位合计 × 此系数（F8） */
  actionsCapPerUnit: 15,
  /** PVE 行动数封顶 */
  pveActionsCap: 200,

  // ---------- 技能池伪预算（Q14，同 normal） ----------
  stopLambda: 10,
} as const;
