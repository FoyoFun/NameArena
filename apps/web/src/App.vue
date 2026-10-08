<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api, ensureMe, getMe, renameMe } from './api';
import { lastBattlePath } from './battleNav';
import { sequencer } from './battle-stage/sequencer';
import { useMode } from './mode';
import GameIcon from './components/GameIcon.vue';
import ModeSelect from './components/ModeSelect.vue';

const route = useRoute();
const router = useRouter();
const ready = ref(false);
const renaming = ref(false);
const newNick = ref('');
const { setMods, activeMode, routeInMode } = useMode();

/** 移动端 Icon 栏的展开菜单（选择后自动收起） */
const ibOpen = ref(false);

onMounted(async () => {
  try {
    await ensureMe();
  } catch (e) {
    console.error('身份初始化失败', e);
  }
  // 模式注册表以服务端 mods 为准（失败时用 mode.ts 兜底表）
  try {
    setMods(await api.mods());
  } catch {
    /* 服务器不在时走兜底 */
  }
  ready.value = true;
  // 初始路径不属于当前模式的页签（如 PVE 模式下直接打开 1vs1 链接）→ 跳默认页
  if (!routeInMode(route.path)) {
    router.replace(activeMode.value?.tabs[0]!.path ?? '/');
  }
});

const isBattleRoute = computed(() => route.path.startsWith('/battle'));

/** 切换模式后若当前页不属于新模式页签，跳到新模式第一个页签 */
watch(activeMode, (mode) => {
  if (!ready.value || !mode) return;
  if (!routeInMode(route.path)) {
    router.push(mode.tabs[0]!.path);
  }
});

// 路由变化自动收起移动端展开菜单
watch(() => route.fullPath, () => {
  ibOpen.value = false;
});

function goBattle() {
  if (!lastBattlePath.value) {
    alert('还没有进行中的战斗——先去 1vs1 快斗一场，或去竞技场挑战');
    return;
  }
  router.push(lastBattlePath.value);
}

async function doRename() {
  const n = newNick.value.trim();
  if (!n) return;
  try {
    await renameMe(n);
    renaming.value = false;
  } catch (e) {
    alert((e as Error).message);
  }
}

function askRename() {
  const me = getMe();
  newNick.value = me?.nickname ?? '';
  renaming.value = !renaming.value;
}

/** TODO：系统设置（决策 #59 预留位，目前无设置项） */
function settingsPlaceholder() {
  alert('系统设置敬请期待');
}
</script>

<template>
  <div class="app-shell">
    <!-- 桌面侧栏：品牌+模式+玩家（上）/ 页签（中）/ 工具钮（下） -->
    <aside class="sidebar">
      <div class="side-logo">
        <span class="mark"><GameIcon name="swords" :size="17" /></span>
        <span class="logo-word">名字大乱斗</span>
      </div>

      <div class="side-mode">
        <ModeSelect />
      </div>

      <div class="side-me" @click="askRename" title="点击改名">
        <GameIcon name="user" :size="15" />
        <span class="nm2">{{ ready && getMe() ? getMe()!.displayName : '连接中…' }}</span>
        <span class="hint">改名</span>
      </div>
      <div v-if="renaming" class="rename-row">
        <input v-model="newNick" class="input" placeholder="新昵称" maxlength="40" @keyup.enter="doRename" />
        <button class="btn small primary" @click="doRename">改名</button>
      </div>

      <nav v-if="activeMode" class="side-nav">
        <template v-for="t in activeMode.tabs" :key="t.path">
          <a
            v-if="t.path === '/battle'"
            :class="{ 'router-link-active': isBattleRoute, dimmed: !lastBattlePath }"
            @click="goBattle"
          >
            <GameIcon name="swords" :size="16" />{{ t.label }}<i v-if="sequencer.state.playing" class="live-dot" />
          </a>
          <router-link v-else :to="t.path">
            <GameIcon :name="t.icon" :size="16" />{{ t.label }}
          </router-link>
        </template>
      </nav>

      <!-- 工具按钮（预留系统设置等） -->
      <div class="side-tools">
        <button class="tool-btn" title="系统设置（敬请期待）" @click="settingsPlaceholder">
          <GameIcon name="cog" :size="15" />
        </button>
      </div>
    </aside>

    <!-- 移动端左侧 Icon 竖栏：平时只占 44px，≡ 展开带文字的菜单 -->
    <nav class="iconbar">
      <button class="ib-toggle" title="展开/收起页签" @click="ibOpen = !ibOpen">
        <GameIcon :name="ibOpen ? 'cross' : 'expand'" :size="16" />
      </button>
      <div v-if="activeMode" class="ib-nav">
        <template v-for="t in activeMode.tabs" :key="t.path">
          <router-link
            v-if="t.path !== '/battle'"
            v-slot="{ isExactActive, isActive, href, navigate }"
            :to="t.path"
            custom
          >
            <a :href="href" class="ib-item" :class="{ 'router-link-active': t.path === '/' ? isExactActive : isActive }" @click="navigate">
              <GameIcon :name="t.icon" :size="17" />
            </a>
          </router-link>
          <a
            v-else
            :class="{ 'router-link-active': isBattleRoute, dimmed: !lastBattlePath }"
            @click="goBattle"
          >
            <i v-if="sequencer.state.playing" class="live-dot" />
            <GameIcon name="swords" :size="17" />
          </a>
        </template>
      </div>
      <button class="ib-toggle" title="系统设置（敬请期待）" @click="settingsPlaceholder">
        <GameIcon name="cog" :size="16" />
      </button>
    </nav>

    <!-- 展开的完整菜单（覆盖层） -->
    <div v-if="ibOpen && activeMode" class="iconbar ib-menu">
      <template v-for="t in activeMode.tabs" :key="t.path">
        <a
          v-if="t.path === '/battle'"
          :class="{ 'router-link-active': isBattleRoute, dimmed: !lastBattlePath }"
          @click="goBattle"
        >
          <GameIcon name="swords" :size="16" />{{ t.label }}<i v-if="sequencer.state.playing" class="live-dot" />
        </a>
        <router-link v-else :to="t.path">
          <GameIcon :name="t.icon" :size="16" />{{ t.label }}
        </router-link>
      </template>
      <div class="ib-tools">
        <a class="navbtn" @click="settingsPlaceholder"><GameIcon name="cog" :size="15" />系统设置</a>
      </div>
    </div>

    <div class="main-col">
      <!-- 移动端顶栏：模式 + 玩家（不放游戏名，防止挤压换行） -->
      <header class="topbar">
        <ModeSelect class="top-mode" />
        <div class="me" @click="askRename" :title="'点击改名'">
          <GameIcon name="user" :size="13" />
          <template v-if="ready && getMe()">
            <b>{{ getMe()!.displayName }}</b>
          </template>
          <template v-else>连接中…</template>
        </div>
      </header>

      <div v-if="renaming" class="page mobile-only" style="padding-bottom: 8px">
        <div class="panel row" style="margin-bottom: 0">
          <input v-model="newNick" class="input" style="flex: 1" placeholder="新的昵称（1~16 位英文/数字/中文）" @keyup.enter="doRename" />
          <button class="btn primary" @click="doRename">改名</button>
        </div>
      </div>

      <main class="page">
        <router-view v-slot="{ Component }" v-if="ready">
          <keep-alive>
            <component :is="Component" />
          </keep-alive>
        </router-view>
        <div v-if="!ready" class="muted empty" style="padding: 40px 0">正在进入竞技场…</div>
      </main>
    </div>
  </div>
</template>

<style scoped>
.dimmed {
  opacity: 0.45;
}

.live-dot {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
  background: var(--hp-lo);
  box-shadow: 0 0 6px var(--hp-lo);
  margin-left: 2px;
  animation: livePulse 1.2s ease-in-out infinite;
}

@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}

.rename-row {
  display: flex;
  gap: 6px;
  padding: 0 10px 10px;
}

.side-mode {
  padding: 0 10px 8px;
}

/* 工具钮：贴侧栏底部 */
.side-tools {
  margin-top: auto;
  display: flex;
  gap: 6px;
  padding: 10px;
  border-top: 1px solid var(--border-soft);
}

.tool-btn {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border-strong);
  background: var(--panel-2);
  color: var(--muted);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: color var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out);
}

.tool-btn:hover {
  color: var(--text);
  border-color: rgba(255, 255, 255, 0.26);
}

/* 移动端顶栏：模式占主体，玩家靠右 */
.top-mode {
  flex: 1;
  min-width: 0;
}

.topbar .me {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  max-width: 130px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.topbar .me b {
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  transition: color var(--dur-1) var(--ease-out);
}

.topbar .me:hover b {
  color: var(--accent);
}

/* iconbar 的展开菜单是固定定位覆盖层，类名挂 .iconbar 上（见模板） */
.ib-menu a {
  cursor: pointer;
}
</style>
