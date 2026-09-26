import { getMod, simulate } from '@namearena/core';
import type { BattleConfig } from '@namearena/core';

/** 诊断：扫描事件流，验证每次伤害/治疗后记录的 hp 与推算值一致（机制层不变量） */

function main() {
  const config: BattleConfig = {
    modId: 'normal-pvp',
    kind: 'async',
    teams: [
      { side: 'A', units: [{ name: '王润新', side: 'A' }, { name: '莫林轲', side: 'A' }] },
      { side: 'B', units: [{ name: '牢大', side: 'B' }, { name: '牢勇', side: 'B' }] },
    ],
  };
  const mod = getMod('normal-pvp');
  let checked = 0;
  let violations = 0;

  for (let seed = 0; seed < 300; seed++) {
    const { events } = simulate(mod, config, seed);
    const hp = new Map<string, number>();
    const maxHp = new Map<string, number>();
    for (let i = 0; i < events.length; i++) {
      const ev = events[i]!;
      if (ev.type === 'battleStart') {
        for (const u of ev.payload['units'] as Array<{ uid: string; stats: Record<string, number> }>) {
          hp.set(u.uid, u.stats['hp']!);
          maxHp.set(u.uid, u.stats['maxHp']!);
        }
        continue;
      }
      const uid = ev.payload['uid'] as string | undefined;
      if (!uid || !hp.has(uid)) continue;
      const before = hp.get(uid)!;
      switch (ev.type) {
        case 'damage': {
          const amount = ev.payload['amount'] as number;
          const after = ev.payload['hp'] as number;
          // 死亡钳制：血量不足时打到 0 为正常
          const expect = Math.max(0, before - amount);
          if (Math.abs(after - expect) > 0.5) {
            violations++;
            if (violations <= 3) {
              console.log(`[seed ${seed} seq ${ev.seq}] hp 不一致：${uid} 事件前=${before} 扣=${amount} 记录后=${after}`);
              console.log(events.slice(Math.max(0, i - 3), i + 2).map((e) => `  ${e.type} ${JSON.stringify(e.payload).slice(0, 120)}`).join('\n'));
            }
          }
          hp.set(uid, after);
          checked++;
          break;
        }
        case 'heal': {
          const amount = ev.payload['amount'] as number;
          const after = ev.payload['hp'] as number;
          if (Math.abs(before + amount - after) > 0.5) {
            violations++;
            console.log(`[seed ${seed} seq ${ev.seq}] heal 不一致：${uid} 前=${before} 治=${amount} 后=${after}`);
          }
          hp.set(uid, after);
          checked++;
          break;
        }
        case 'statChange': {
          if (ev.payload['stat'] === 'hp') hp.set(uid, ev.payload['value'] as number);
          break;
        }
        case 'unitDown': {
          if (before !== 0) {
            violations++;
            console.log(`[seed ${seed} seq ${ev.seq}] unitDown 时 hp=${before} ≠ 0`);
          }
          break;
        }
      }
    }
  }
  console.log(`检查了 ${checked} 次血量变更，发现 ${violations} 处不一致`);
}

main();
