import { computed, ref, watch } from 'vue';
import type { ModInfo } from './api';

/**
 * 全局模式状态（决策 #59）：模式 = 一个可玩的生成域（fantasy-pvp / fantasy-pve…），
 * 由服务端 mods 列表驱动。模式决定侧栏页签与各页的生成域；
 * 侧栏顶部下拉切换，选择持久化到 localStorage。
 *
 * 页签归属约定：1vs1 → PVP 域专属；我的队伍 / 战斗 / 战报 双域共有；
 * 竞技场（讨伐）双域共有但排版随模式；讨伐榜 → PVE 域专属。
 */

export interface ModeTab {
  path: string;
  label: string;
  icon: string;
}

export interface ModeDef {
  id: string;
  name: string;
  kind: 'pvp' | 'pve';
  icon: string;
  tabs: ModeTab[];
}

const PVP_TABS: ModeTab[] = [
  { path: '/', label: '1vs1', icon: 'lab' },
  { path: '/teams', label: '我的队伍', icon: 'team' },
  { path: '/pool', label: '竞技场', icon: 'arena' },
  { path: '/battle', label: '战斗', icon: 'swords' },
  { path: '/history', label: '战报', icon: 'report' },
  { path: '/ladder', label: '天梯', icon: 'ladder' },
];

const PVE_TABS: ModeTab[] = [
  { path: '/teams', label: '我的队伍', icon: 'team' },
  { path: '/pool', label: '讨伐', icon: 'skull' },
  { path: '/battle', label: '战斗', icon: 'swords' },
  { path: '/history', label: '战报', icon: 'report' },
  { path: '/ladder', label: '讨伐榜', icon: 'ladder' },
];

/** mods 接口不可达时的兜底（与服务器注册表保持一致的硬编码副本） */
const FALLBACK: ModeDef[] = [
  { id: 'fantasy-pvp', name: '幻想大乱斗PVP', kind: 'pvp', icon: 'swords', tabs: PVP_TABS },
  { id: 'fantasy-pve', name: '幻想大乱斗PVE', kind: 'pve', icon: 'skull', tabs: PVE_TABS },
];

const modes = ref<ModeDef[]>(FALLBACK);

const STORAGE_KEY = 'na:mode';
const activeModeId = ref(localStorage.getItem(STORAGE_KEY) ?? '');

/** 当前模式（mods 未加载或 id 失效时回落到第一个） */
const activeMode = computed<ModeDef>(
  () => modes.value.find((m) => m.id === activeModeId.value) ?? modes.value[0]!,
);

watch(activeModeId, (id) => {
  if (id) localStorage.setItem(STORAGE_KEY, id);
});

/** 由服务端 mods 列表构建模式注册表（命名约定：*-pvp / *-pve） */
function setMods(list: ModInfo[]): void {
  modes.value = list.map((m) => {
    const kind: ModeDef['kind'] = m.id.endsWith('-pve') ? 'pve' : 'pvp';
    return {
      id: m.id,
      name: m.name,
      kind,
      icon: kind === 'pve' ? 'skull' : 'swords',
      tabs: kind === 'pve' ? PVE_TABS : PVP_TABS,
    };
  });
  if (!modes.value.some((m) => m.id === activeModeId.value)) {
    activeModeId.value = modes.value[0]?.id ?? '';
  }
}

/** 当前路径是否属于当前模式的页签（battle 前缀路由按前缀判断） */
function routeInMode(path: string): boolean {
  const tabs = activeMode.value?.tabs ?? [];
  return tabs.some((t) => (t.exact ? path === t.path : path === t.path || path.startsWith(`${t.path}/`)));
}

export function useMode() {
  return { modes, activeMode, activeModeId, setMods, routeInMode };
}
