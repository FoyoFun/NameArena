<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ensureMe, getMe, renameMe } from './api';
import { lastBattlePath } from './battleNav';
import { sequencer } from './battle-stage/sequencer';

const route = useRoute();
const router = useRouter();
const ready = ref(false);
const renaming = ref(false);
const newNick = ref('');

onMounted(async () => {
  try {
    await ensureMe();
  } catch (e) {
    console.error('身份初始化失败', e);
  }
  ready.value = true;
});

const isBattleRoute = computed(() => route.path.startsWith('/battle'));

function goBattle() {
  if (!lastBattlePath.value) {
    alert('还没有进行中的战斗——先去取名实验室快斗一场，或去竞技场挑战');
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
</script>

<template>
  <header class="topbar">
    <div class="logo">⚔️ 名字大乱斗</div>
    <div class="me" @click="askRename" :title="'点击改名'">
      <template v-if="ready && getMe()">
        <b>{{ getMe()!.displayName }}</b>
      </template>
      <template v-else>连接中…</template>
    </div>
  </header>

  <div v-if="renaming" class="page" style="padding-bottom: 8px">
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
    <div v-if="!ready" class="muted" style="text-align: center; padding: 40px 0">正在进入竞技场…</div>
  </main>

  <nav class="navbar">
    <router-link to="/"><span class="ico">🧪</span>取名</router-link>
    <router-link to="/teams"><span class="ico">🛡️</span>队伍</router-link>
    <router-link to="/pool"><span class="ico">🏟️</span>竞技</router-link>
    <a :class="{ 'router-link-active': isBattleRoute, dimmed: !lastBattlePath }" @click="goBattle">
      <span class="ico">⚔️<i v-if="sequencer.state.playing" class="live-dot" /></span>战斗
    </a>
    <router-link to="/history"><span class="ico">📜</span>战报</router-link>
    <router-link to="/ladder"><span class="ico">🏆</span>天梯</router-link>
  </nav>
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
  vertical-align: top;
  margin-left: -2px;
  animation: livePulse 1.2s ease-in-out infinite;
}

@keyframes livePulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.35; }
}
</style>
