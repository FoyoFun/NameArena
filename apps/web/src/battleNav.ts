import { ref } from 'vue';

/** 当前/最近一场战斗的路由路径，供导航「战斗」页签使用（DESIGN.md #48）。
 *  sessionStorage：刷新页面后仍能回到那场战斗。 */
const KEY = 'namearena_last_battle';

export const lastBattlePath = ref<string | null>(sessionStorage.getItem(KEY));

export function setLastBattlePath(path: string): void {
  lastBattlePath.value = path;
  sessionStorage.setItem(KEY, path);
}
