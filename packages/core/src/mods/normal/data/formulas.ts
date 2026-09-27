/**
 * 战斗公式系数（DESIGN.md 7.7）。全部集中于此，改必跑批量模拟（scripts/sim）。
 */
export const FORMULAS = {
  /** 伤害随机浮动 [min, max] 倍 */
  varianceMin: 0.9,
  varianceMax: 1.1,
  /** 差值项系数：1 + max(0, 攻方主属性 − 守方主抗) × coef。保证属性尾部真正强悍 */
  diffCoef: 0.006,
  /** 命中 = clamp(1 − 守方闪避 + (攻方spd − 守方spd) × coef, hitMin, 1)。25% 下限保证弱者不绝望 */
  hitAgiCoef: 0.0025,
  hitMin: 0.25,
  /** 暴击率上限 */
  critCap: 0.6,
  mpRegenBase: 5,
  mpRegenSpr: 0.5,
  /** 回合上限与僵局判定 */
  maxRounds: 30,
  /** 行动槽上限（含二连击等加成） */
  maxActionSlots: 3,
  minDamage: 1,
  /** 伪预算止步曲线：P_stop = 1 − e^(−cost/λ)。λ 越大角色越"贪"，头奖越容易出现 */
  stopLambda: 10,
  /** 行动顺序：幸运提供的排序加成（先攻并列时的天平） */
  luckTieBias: 0.0015,
  /** 行动顺序每回合随机抖动幅度：速度差在此之内的角色先后会互换（节目效果，DESIGN.md #43） */
  roundJitter: 5,
  /** 目标选择：锁定残血的概率（其余随机选）。1 = 永远集火残血，0 = 纯随机（节目效果，DESIGN.md #43） */
  targetFocusBias: 0.1,
  /** AI 选行动：分数前 K 名按分数轮盘赌（1 = 永远选最优解；节目效果，DESIGN.md #43） */
  aiTopK: 3,
} as const;
