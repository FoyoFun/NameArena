import { defineAbility } from './define';
import type { BattleContext, UnitRuntime } from '../../../engine';

export default defineAbility({
  id: 'phoenix',
  name: '不死鸟',
  kind: 'passive',
  cost: 8,
  weight: 0.5,
  stackable: false,
  desc: '首次被击倒时浴火重生，以 30% 生命回到战场。仅一次。',
  tags: ['buff'],
  hooks: {
    onKO: (ctx: BattleContext, unit: UnitRuntime): void => {
      if (unit.meta['phoenixUsed']) return;
      unit.meta['phoenixUsed'] = true;
      unit.alive = true;
      unit.stats['hp'] = Math.max(1, Math.round((unit.stats['maxHp'] ?? 100) * 0.3));
      ctx.emit('heal', { uid: unit.uid, amount: unit.stats['hp']!, hp: unit.stats['hp']!, maxHp: unit.stats['maxHp']!, source: '浴火重生' }, [
        { target: `unit:${unit.uid}`, vfx: 'revive', durationMs: 1200, logText: `🔥 @${unit.uid}@ 浴火重生了！` },
      ]);
    },
  },
});
