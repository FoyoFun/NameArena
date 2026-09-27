import { reactive } from 'vue';
import type { BattleEvent } from '@namearena/core';
import { STATUS_MAP } from '@namearena/core';

/**
 * 战斗播放状态机（表现框架的核心，DESIGN.md 5.4）。
 * 消费事件流 → 维护可渲染状态（单位卡/飘字/VFX/战报）。
 * 直播、回放、历史重演共用这一套；播放节奏由客户端决定。
 */

export interface UnitViewState {
  uid: string;
  side: string;
  name: string;
  owner: string;
  personalityName: string;
  personalityDesc: string;
  stats: Record<string, number>;
  base: Record<string, number>;
  tiers: Record<string, string>;
  abilities: { id: string; name: string; desc: string; kind: string; source: string; cost: number }[];
  totalCost: number;
  statuses: { id: string; name: string; kind: string; remain: number }[];
  down: boolean;
}

export interface LogEntry {
  id: number;
  /** 该行所属阵营：A 靠左、B 靠右；null 居中灰显 */
  side: 'A' | 'B' | null;
  dim: boolean;
  /** 战报文本，含轻量标记：@uid@ 名字徽章、+…+ 增益绿、~…~ 减益红 */
  text: string;
}

export interface FloatItem {
  id: number;
  uid: string;
  text: string;
  kind: 'damage' | 'crit' | 'heal' | 'miss';
  born: number;
}

export interface ActiveVfx {
  id: number;
  vfx: string;
  target: string;
  emoji: string;
  born: number;
}

function noop(): void {
  /* 占位：避免 tree-shaking 误删 reactive 引用 */
}
void noop;

export class Sequencer {
  state = reactive({
    units: [] as UnitViewState[],
    floats: [] as FloatItem[],
    vfxes: [] as ActiveVfx[],
    log: [] as LogEntry[],
    playing: false,
    finished: false,
    round: 0,
    speed: 1,
    /** 播放代次：每场 play 递增。BattleStage 用它掺进单位卡 key，重播时重建卡片重放入场动画 */
    gen: 0,
    result: null as null | { winner: string | null; rounds: number; reason: string },
  });

  private nextId = 1;
  private skipFlag = false;
  private waiters: Array<{ t: ReturnType<typeof setTimeout>; res: () => void }> = [];  /**
   * 播放代次：只有 play 会递增它。新 play 开始后，更早的播放循环在下一个
   * 检查点自行退出——没有它，快速连开两场战斗时新旧循环会交错应用各自的事件流
   * （DESIGN.md #45）。⚠️ reset 千万不要动 runId，否则当前 play 会误杀自己。
   */
  private runId = 0;

  reset(): void {
    this.state.units = [];
    this.state.floats = [];
    this.state.vfxes = [];
    this.state.log = [];
    this.state.playing = false;
    this.state.finished = false;
    this.state.round = 0;
    this.state.result = null;
    this.skipFlag = false;
    this.waiters = [];
  }

  skip(): void {
    this.skipFlag = true;
    for (const w of this.waiters) {
      clearTimeout(w.t);
      w.res();
    }
    this.waiters = [];
  }

  setSpeed(s: number): void {
    this.state.speed = s;
  }

  async play(events: BattleEvent[]): Promise<void> {
    const myRun = ++this.runId; // 使任何尚在运行的旧播放循环失效
    this.reset();
    if (this.runId !== myRun) return; // 极端竞态下直接让位
    this.state.gen++;
    this.state.playing = true;
    for (const ev of events) {
      if (myRun !== this.runId) return; // 已被新一场战斗取代，旧事件流作废
      const dur = this.applyEvent(ev);
      if (!this.skipFlag && dur > 0) {
        await this.wait(dur / this.state.speed);
        if (myRun !== this.runId) return;
      }
      this.prune();
    }
    if (myRun !== this.runId) return;
    this.state.playing = false;
    this.state.finished = true;
  }

  private wait(ms: number): Promise<void> {
    return new Promise((res) => {
      const t = setTimeout(() => {
        this.waiters = this.waiters.filter((w) => w.res !== res);
        res();
      }, ms);
      this.waiters.push({ t, res });
    });
  }

  private prune(): void {
    const now = Date.now();
    if (!this.skipFlag) {
      // 窗口须 ≥ theme.css 里对应动画的总时长（飘字 1.05s/暴击 1.15s、特效弹出 0.8s/复活 1s）
      this.state.floats = this.state.floats.filter((f) => now - f.born < 1250);
      this.state.vfxes = this.state.vfxes.filter((v) => now - v.born < 1050);
    } else {
      this.state.floats = [];
      this.state.vfxes = [];
    }
  }

  private addFloat(uid: string, text: string, kind: FloatItem['kind']): void {
    this.state.floats.push({ id: this.nextId++, uid, text, kind, born: Date.now() });
  }

  private addVfx(vfx: string | undefined, target: string | undefined): void {
    if (!vfx || !target) return;
    this.state.vfxes.push({ id: this.nextId++, vfx, target, emoji: SKILL_EMOJI[vfx] ?? '', born: Date.now() });
  }

  private pushLog(ev: BattleEvent, present: { logText?: string }[]): void {
    // 行的对齐归属：事件主语单位的阵营（skillUse=施放者，damage/heal/miss=承受者）
    const uid = (ev.payload['uid'] ?? ev.payload['attackerUid']) as string | undefined;
    const u = uid ? this.unit(uid) : undefined;
    const side = (u?.side ?? null) as 'A' | 'B' | null;
    for (const p of present) {
      if (p.logText) {
        this.state.log.push({ id: this.nextId++, side, dim: side === null, text: p.logText });
      }
    }
  }

  /** 应用一个事件到渲染状态，返回建议播放时长（毫秒） */
  applyEvent(ev: BattleEvent): number {
    let duration = 550;
    for (const p of ev.present) {
      if (p.durationMs && p.durationMs > duration) duration = p.durationMs;
    }
    this.pushLog(ev, ev.present);

    switch (ev.type) {
      case 'battleStart': {
        this.state.units = (ev.payload['units'] as UnitViewState[]).map((u) => ({
          ...u,
          statuses: [],
          down: false,
        }));
        this.addVfx('stage', 'stage');
        break;
      }
      case 'roundStart': {
        this.state.round = ev.payload['round'] as number;
        break;
      }
      case 'skillUse': {
        const targets = ev.payload['targets'] as string[];
        const spec = ev.present[0];
        const target = targets?.length === 1 ? `unit:${targets[0]}` : spec?.target;
        this.addVfx(spec?.vfx, target ?? `unit:${ev.payload['uid']}`);
        break;
      }
      case 'damage': {
        const uid = ev.payload['uid'] as string;
        const amount = ev.payload['amount'] as number;
        const crit = ev.payload['crit'] as boolean;
        const absorbed = (ev.payload['absorbed'] as number) ?? 0;
        this.updateStat(uid, 'hp', ev.payload['hp'] as number);
        const u = this.unit(uid);
        if (u) {
          this.addVfx(crit ? 'crit-flash' : 'hit', `unit:${uid}`);
          if (amount > 0) {
            this.addFloat(uid, crit ? `暴击 ${amount}` : `-${amount}`, crit ? 'crit' : 'damage');
          } else if (absorbed > 0) {
            this.addFloat(uid, '护盾!', 'miss');
          }
        }
        break;
      }
      case 'heal': {
        const uid = ev.payload['uid'] as string;
        const amount = ev.payload['amount'] as number;
        this.updateStat(uid, 'hp', ev.payload['hp'] as number);
        if (amount > 0) this.addFloat(uid, `+${amount}`, 'heal');
        break;
      }
      case 'miss': {
        const uid = ev.payload['uid'] as string;
        this.addVfx('miss', `unit:${uid}`);
        this.addFloat(uid, 'MISS', 'miss');
        break;
      }
      case 'statusApply': {
        const uid = ev.payload['uid'] as string;
        const statusId = ev.payload['status'] as string;
        const u = this.unit(uid);
        if (u && !u.statuses.some((s) => s.id === statusId)) {
          const def = STATUS_MAP.get(statusId);
          u.statuses.push({ id: statusId, name: def?.name ?? statusId, kind: def?.kind ?? 'buff', remain: 0 });
          this.addVfx(def?.kind === 'buff' ? 'buff' : 'debuff', `unit:${uid}`);
        }
        break;
      }
      case 'statusRemove': {
        const uid = ev.payload['uid'] as string;
        const statusId = ev.payload['status'] as string;
        const u = this.unit(uid);
        if (u) u.statuses = u.statuses.filter((s) => s.id !== statusId);
        break;
      }
      case 'statChange': {
        this.updateStat(ev.payload['uid'] as string, ev.payload['stat'] as string, ev.payload['value'] as number);
        break;
      }
      case 'unitDown': {
        const uid = ev.payload['uid'] as string;
        const u = this.unit(uid);
        if (u) u.down = true;
        // KO 终结演出：卡上放大闪灭 + ☠️，并把节拍拉长半拍再继续
        this.addVfx('ko', `unit:${uid}`);
        duration = Math.max(duration, 850);
        break;
      }
      case 'battleEnd': {
        this.state.result = {
          winner: (ev.payload['winner'] as string | null) ?? null,
          rounds: ev.payload['rounds'] as number,
          reason: ev.payload['reason'] as string,
        };
        break;
      }
      default:
        break;
    }
    return duration;
  }

  private unit(uid: string): UnitViewState | undefined {
    return this.state.units.find((u) => u.uid === uid);
  }

  private updateStat(uid: string, key: string, value: number): void {
    const u = this.unit(uid);
    if (u) u.stats[key] = value;
  }
}

/** 技能/事件特效 → emoji 映射（VFX 注册表的视觉部分，见 vfx.ts 说明） */
export const SKILL_EMOJI: Record<string, string> = {
  slash: '⚔️',
  fireball: '🔥',
  frost: '❄️',
  poison: '🧪',
  stun: '💫',
  meteor: '☄️',
  heal: '💚',
  buff: '✨',
  debuff: '🌀',
  hit: '💢',
  'crit-flash': '💥',
  miss: '❓',
  ko: '☠️',
  revive: '🔥',
  'aura-gold': '🌟',
  stage: '',
};

export const sequencer = new Sequencer();
