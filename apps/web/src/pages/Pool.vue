<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { api, type ModInfo, type TeamInfo } from '../api';

const router = useRouter();
const mods = ref<ModInfo[]>([]);
const activeMod = ref('normal-pvp');
const pool = ref<TeamInfo[]>([]);
const myTeams = ref<TeamInfo[]>([]);
const attackerId = ref('');
const selfA = ref('');
const selfB = ref('');
const busy = ref(false);
const error = ref('');

const isPve = computed(() => activeMod.value.endsWith('-pve'));
const mod = computed(() => mods.value.find((m) => m.id === activeMod.value));
const myModTeams = computed(() => myTeams.value.filter((t) => t.modId === activeMod.value));

onMounted(async () => {
  mods.value = await api.mods();
  await refresh();
});

// keep-alive：切页回来刷新数据，保留所选 tab / 出战队伍；并复位挑战按钮
onActivated(async () => {
  busy.value = false;
  if (mods.value.length) await refresh();
});

async function refresh() {
  [pool.value, myTeams.value] = await Promise.all([
    api.pool(activeMod.value).catch(() => []),
    api.myTeams(),
  ]);
  const mine = myTeams.value.filter((t) => t.modId === activeMod.value);
  if (!mine.some((t) => t.id === attackerId.value)) {
    attackerId.value = mine[0]?.id ?? '';
  }
  if (!mine.some((t) => t.id === selfA.value)) selfA.value = mine[0]?.id ?? '';
  if (!mine.some((t) => t.id === selfB.value)) selfB.value = mine[1]?.id ?? mine[0]?.id ?? '';
}

/** 我的队伍互斗（DESIGN.md 优化 #4）：两边都用自己的队，无需入池 */
async function selfBattle() {
  if (!selfA.value || !selfB.value) {
    error.value = '先选两支出战队伍';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const { id } = await api.createBattle({
      kind: 'async',
      modId: activeMod.value,
      attackerTeamId: selfA.value,
      defenderTeamId: selfB.value,
    });
    busy.value = false;
    router.push(`/battle/${id}`);
  } catch (e) {
    error.value = (e as Error).message;
    busy.value = false;
  }
}

function teamLabel(id: string): string {
  const t = myTeams.value.find((x) => x.id === id);
  return t ? t.members.join('·') : '';
}

function switchMod(id: string) {
  activeMod.value = id;
  attackerId.value = '';
  void refresh();
}

async function challenge(defenderId?: string, bossId?: string) {
  if (!attackerId.value) {
    error.value = isPve.value ? '先选一支 PVE 队伍出战' : '先选一支出战队伍';
    return;
  }
  busy.value = true;
  error.value = '';
  try {
    const { id } = await api.createBattle({
      kind: isPve.value ? 'pve' : 'async',
      modId: activeMod.value,
      attackerTeamId: attackerId.value,
      defenderTeamId: defenderId,
      bossId,
    });
    busy.value = false; // 复位：keep-alive 下切回本页时按钮必须可点
    router.push(`/battle/${id}`);
  } catch (e) {
    error.value = (e as Error).message;
    busy.value = false;
  }
}

function winrate(t: TeamInfo): string {
  const n = t.wins + t.losses;
  return n === 0 ? '—' : `${Math.round((t.wins / n) * 100)}%`;
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">🏟️ 竞技场</div>
    <div class="row" style="margin-bottom: 10px">
      <button
        v-for="m in mods"
        :key="m.id"
        class="btn small"
        :class="{ primary: m.id === activeMod }"
        @click="switchMod(m.id)"
      >
        {{ m.name }}
      </button>
    </div>

    <div class="row">
      <span class="muted">出战队伍：</span>
      <select v-model="attackerId" class="input" style="flex: 1; min-width: 200px">
        <option value="" disabled>选择你的队伍</option>
        <option v-for="t in myTeams.filter((x) => x.modId === activeMod)" :key="t.id" :value="t.id">
          {{ t.members.join(' · ') }}（{{ t.wins }}胜{{ t.losses }}负）
        </option>
      </select>
      <button class="btn small" @click="refresh()">刷新</button>
    </div>
    <div v-if="error" class="error-text" style="margin-top: 6px">{{ error }}</div>
  </div>

  <template v-if="!isPve">
    <div class="panel">
      <div class="panel-title">🤜🤛 我的队伍互斗</div>
      <div class="muted" style="margin-bottom: 8px">左边捶右边，自己的队伍随便打，不计入数据池门槛。</div>
      <div class="row">
        <select v-model="selfA" class="input" style="flex: 1; min-width: 140px">
          <option v-for="t in myModTeams" :key="t.id" :value="t.id">{{ teamLabel(t.id) }}</option>
        </select>
        <span class="muted">vs</span>
        <select v-model="selfB" class="input" style="flex: 1; min-width: 140px">
          <option v-for="t in myModTeams" :key="t.id" :value="t.id">{{ teamLabel(t.id) }}</option>
        </select>
        <button class="btn primary" :disabled="busy || myModTeams.length < (selfA === selfB ? 1 : 2)" @click="selfBattle">开打</button>
      </div>
      <div v-if="myModTeams.length === 0" class="muted" style="margin-top: 6px">还没有队伍，先去「队伍」页建一支</div>
    </div>

    <div class="panel">
      <div class="panel-title">📚 数据池（{{ pool.length }} 支离线队伍）</div>
      <div class="muted" style="margin-bottom: 8px">挑战别人用过的队伍，对方不在线也能打。打完双方都记入战绩。</div>
      <div v-for="t in pool" :key="t.id" class="row" style="justify-content: space-between; padding: 7px 0; border-bottom: 1px solid var(--border)">
        <div>
          <b>{{ t.members.join(' · ') }}</b>
          <span class="muted" style="margin-left: 6px">{{ t.owner }}</span>
          <span class="tag" style="margin-left: 6px">{{ t.wins }}胜{{ t.losses }}负 · {{ winrate(t) }}</span>
        </div>
        <button class="btn small primary" :disabled="busy" @click="challenge(t.id)">挑战</button>
      </div>
      <div v-if="pool.length === 0" class="muted" style="text-align: center; padding: 16px">
        池子还空着——先去打几场，或者等群友的队伍入池
      </div>
    </div>
  </template>

  <template v-else>
    <div class="panel">
      <div class="panel-title">👹 PVE 强敌</div>
      <div v-for="b in mod?.bosses ?? []" :key="b.id" class="row" style="justify-content: space-between; padding: 8px 0; border-bottom: 1px solid var(--border)">
        <div>
          <b>{{ b.name }}</b>
          <span class="tag gold" style="margin-left: 6px">{{ b.title }}</span>
          <div class="muted" style="margin-top: 2px">{{ b.desc }}</div>
        </div>
        <button class="btn small primary" :disabled="busy" @click="challenge(undefined, b.id)">讨伐</button>
      </div>
      <div class="muted" style="margin-top: 8px">PVE 最多可带 {{ mod?.maxUnits }} 人，人数不足不补，多打少是勇士的浪漫。</div>
    </div>
  </template>
</template>
