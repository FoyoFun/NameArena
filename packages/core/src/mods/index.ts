import type { Mod } from '../engine';
import { NORMAL_PVE, NORMAL_PVP } from './normal/mod';

export const MODS: Mod[] = [NORMAL_PVP, NORMAL_PVE];

export function getMod(id: string): Mod {
  const mod = MODS.find((m) => m.id === id);
  if (!mod) throw new Error(`未知模组：${id}`);
  return mod;
}

export * from './normal/mod';
