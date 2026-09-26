import type { Rng } from '../name-gen';
import type {
  BattleConfig,
  BattleContext,
  BattleEvent,
  BattleEventType,
  BattleState,
  PresentSpec,
  UnitRuntime,
} from './types';

export function createContext(config: BattleConfig, rng: Rng): { ctx: BattleContext; events: BattleEvent[] } {
  const events: BattleEvent[] = [];
  const state: BattleState = {
    round: 0,
    units: [],
    over: false,
    winner: null,
    scratch: {},
  };
  const ctx: BattleContext = {
    config,
    state,
    rng,
    emit(type: BattleEventType, payload: Record<string, unknown> = {}, present: PresentSpec[] = []) {
      const event: BattleEvent = {
        seq: events.length,
        type,
        payload,
        present,
      };
      events.push(event);
      return event;
    },
  };
  return { ctx, events };
}

export function makeUnit(
  uid: string,
  side: string,
  name: string,
  char: unknown,
  owner?: string,
): UnitRuntime {
  return {
    uid,
    side,
    name,
    char,
    alive: true,
    stats: {},
    statuses: [],
    meta: owner !== undefined ? { owner } : {},
  };
}

/** 读取单位便签（不存在则初始化） */
export function unitScratch<T>(unit: UnitRuntime, key: string, init: () => T): T {
  if (!(key in unit.meta)) unit.meta[key] = init();
  return unit.meta[key] as T;
}
