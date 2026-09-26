import { makeUnit } from '../../../engine';
import type { BattleContext, Ruleset, UnitConfig } from '../../../engine';
import { BOSS_MAP, BOSSES } from '../data/bosses';
import { FORMULAS } from '../data/formulas';
import { STATUS_MAP } from '../data/statuses';
import { generateNormalCharacter } from '../generation';
import { chooseAction } from './ai';
import { endRound, performAction } from './combat';
import { setDeathHandler } from './effects';
import { applyModifyActionCount, fireOnKO } from './hooks';
import { baseOf, effStat } from './stats';
import { bossCharacter, initUnitStats, unitSnapshot } from './setup';
import type { Character } from '../types';

// 死亡 → onKO hook（不死鸟复活等）
setDeathHandler((ctx, unit) => fireOnKO(ctx, unit));

interface QueueItem {
  uid: string;
  slots: number;
}

function sideText(ctx: BattleContext, side: string): string {
  // 名字用 @uid@ 标记，客户端渲染为对应阵营的名字徽章
  return ctx.state.units
    .filter((u) => u.side === side)
    .map((u) => `@${u.uid}@`)
    .join('、');
}

function sides(ctx: BattleContext): string[] {
  return [...new Set(ctx.state.units.map((u) => u.side))];
}

function endBattle(ctx: BattleContext, winner: string | null, reason: 'wipe' | 'attrition' | 'stalemate'): void {
  ctx.state.over = true;
  ctx.state.winner = winner;
  const result = { winner, rounds: ctx.state.round, reason };
  ctx.state.scratch['result'] = result;
  const reasonText = reason === 'wipe' ? '全歼' : reason === 'attrition' ? '到达回合上限，按剩余生命判定' : '势均力敌';
  const winText = winner === null ? '🤝 平局！' : `🏆 【${sideText(ctx, winner)}】(${winner} 方) 获胜！`;
  ctx.emit('battleEnd', { ...result }, [
    { durationMs: 1500, logText: `${winText} —— ${reasonText}，共 ${ctx.state.round} 回合` },
  ]);
}

function checkWipe(ctx: BattleContext): void {
  const all = sides(ctx);
  const wiped = all.filter((s) => !ctx.state.units.some((u) => u.side === s && u.alive));
  if (wiped.length === 0) return;
  if (wiped.length >= all.length) {
    endBattle(ctx, null, 'wipe');
    return;
  }
  endBattle(
    ctx,
    all.find((s) => !wiped.includes(s))!,
    'wipe',
  );
}

function endByAttrition(ctx: BattleContext): void {
  const all = sides(ctx);
  const ratio = (s: string) =>
    ctx.state.units
      .filter((u) => u.side === s)
      .reduce((sum, u) => sum + u.stats['hp']! / u.stats['maxHp']!, 0);
  const ratios = all.map((s) => ({ side: s, score: ratio(s) }));
  const best = Math.max(...ratios.map((r) => r.score));
  const top = ratios.filter((r) => Math.abs(r.score - best) < 1e-9);
  if (top.length === 1) {
    endBattle(ctx, top[0]!.side, 'attrition');
    return;
  }
  // 生命比并列 → 比总输出
  const dealt = ctx.state.scratch['dealt'] as Record<string, number>;
  const topSides = top.map((t) => t.side);
  const bestDealt = Math.max(...topSides.map((s) => dealt[s] ?? 0));
  const winners = topSides.filter((s) => (dealt[s] ?? 0) === bestDealt);
  endBattle(ctx, winners.length === 1 ? winners[0]! : null, 'attrition');
}

function buildOrder(ctx: BattleContext): QueueItem[] {
  const keyed = ctx.state.units
    .filter((u) => u.alive)
    .map((u) => ({
      uid: u.uid,
      key:
        effStat(u, 'spd') +
        ctx.rng.next() * FORMULAS.roundJitter +
        baseOf(u).luk * FORMULAS.luckTieBias,
      slots: Math.min(FORMULAS.maxActionSlots, 1 + applyModifyActionCount(ctx, u)),
    }));
  keyed.sort((a, b) => b.key - a.key);
  return keyed.map(({ uid, slots }) => ({ uid, slots }));
}

/** 常规回合制规则（DESIGN.md 7.6）。pvp 与 pve 共用，pve 的 B 方永远由 Boss 数据重建。 */
export function normalRuleset(kind: 'pvp' | 'pve', genKey: string, genVersion: number): Ruleset {
  return {
    initBattle(ctx) {
      ctx.state.scratch['queue'] = [] as QueueItem[];
      ctx.state.scratch['dealt'] = {} as Record<string, number>;

      for (const team of ctx.config.teams) {
        (ctx.state.scratch['dealt'] as Record<string, number>)[team.side] = 0;
        let unitCfgs: (UnitConfig & { char?: unknown })[] = team.units as (UnitConfig & { char?: unknown })[];
        // PVE 的 B 方由 Boss 数据重建（config 里只是展示用的名字占位）
        if (kind === 'pve' && team.side === 'B') {
          const def = BOSS_MAP.get(ctx.config.bossId ?? '') ?? BOSSES[0]!;
          unitCfgs = [{ name: def.name, side: team.side, char: bossCharacter(def) }];
        }
        unitCfgs.forEach((uc, i) => {
          const char = (uc.char as Character | undefined) ?? generateNormalCharacter(uc.name, genKey, genVersion);
          const unit = makeUnit(`${team.side}-${i + 1}`, team.side, char.name, char, uc.owner);
          initUnitStats(unit, char);
          ctx.state.units.push(unit);
        });
      }

      ctx.emit('battleStart', { units: ctx.state.units.map(unitSnapshot), modId: ctx.config.modId, kind }, [
        {
          vfx: 'stage',
          durationMs: 1300,
          logText: `⚔️ 对阵：【${sideText(ctx, 'A')}】 vs 【${sideText(ctx, 'B')}】`,
        },
      ]);
    },

    nextAction(ctx) {
      if (ctx.state.over) return;
      let queue = ctx.state.scratch['queue'] as QueueItem[];
      if (!queue || queue.length === 0) {
        ctx.state.round += 1;
        if (ctx.state.round > FORMULAS.maxRounds) {
          endByAttrition(ctx);
          return;
        }
        queue = buildOrder(ctx);
        if (queue.length === 0) {
          endBattle(ctx, null, 'stalemate');
          return;
        }
        ctx.state.scratch['queue'] = queue;
        ctx.emit('roundStart', { round: ctx.state.round }, [
          { durationMs: 350, logText: `—— 第 ${ctx.state.round} 回合 ——` },
        ]);
      }

      while (queue.length > 0) {
        const head = queue[0]!;
        const unit = ctx.state.units.find((u) => u.uid === head.uid)!;
        if (!unit.alive || head.slots <= 0) {
          queue.shift();
          continue;
        }
        const stun = unit.statuses.find((s) => STATUS_MAP.get(s.id)?.control === 'stun');
        if (stun) {
          unit.statuses = unit.statuses.filter((s) => s !== stun);
          queue.shift();
          ctx.emit('log', { uid: unit.uid }, [
            { target: `unit:${unit.uid}`, vfx: 'stun', durationMs: 750, logText: `💫 @${unit.uid}@ #眩晕#中，无法行动！` },
          ]);
          return;
        }
        head.slots -= 1;
        const choice = chooseAction(ctx, unit);
        performAction(ctx, unit, {
          id: choice.ability.id,
          name: choice.ability.name,
          vfx: choice.ability.vfx,
          active: choice.ability.active!,
        });
        checkWipe(ctx);
        return;
      }

      // 本回合行动耗尽 → 回合收尾
      ctx.state.scratch['queue'] = [];
      endRound(ctx);
      checkWipe(ctx);
    },

    isOver(state) {
      return state.over;
    },
  };
}
