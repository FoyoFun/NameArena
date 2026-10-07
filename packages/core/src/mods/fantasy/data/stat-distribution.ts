import type { Rng } from '../../../name-gen';

/**
 * 六维分布分层数据表（DESIGN-FANTASY.md §3.1，Q22 裁定）：
 * 10~89 完全等概率；1~9 / 91~99 / 100~999 沿用 normal 分层（尾部与头奖量级不变）。
 */
export interface StatTier {
  id: string;
  label: string;
  min: number;
  max: number;
  weight: number;
  color: string;
}

export const STAT_TIERS: StatTier[] = [
  { id: 'mid', label: '常规', min: 10, max: 89, weight: 0.8, color: '#9ca3af' },
  { id: 'low', label: '深渊', min: 1, max: 9, weight: 0.097, color: '#60a5fa' },
  { id: 'high', label: '尾部', min: 91, max: 99, weight: 0.097, color: '#a78bfa' },
  { id: 'super', label: '超凡', min: 100, max: 150, weight: 0.0015, color: '#fbbf24' },
  { id: 'mythic', label: '神话', min: 151, max: 300, weight: 0.0004, color: '#f87171' },
  { id: 'godly', label: '逆天', min: 301, max: 999, weight: 0.0001, color: '#f0abfc' },
];

export const TIER_MAP = new Map(STAT_TIERS.map((t) => [t.id, t]));

export function rollStat(rng: Rng): { value: number; tier: StatTier } {
  const tier = rng.weighted(STAT_TIERS.map((t) => ({ item: t, weight: t.weight })));
  return { value: rng.int(tier.min, tier.max), tier };
}
