<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { api, type LadderRow, type ModInfo, type PveLadderRow } from '../api';

const mods = ref<ModInfo[]>([]);
const mode = ref<'name' | 'pve'>('name');
const modId = ref('fantasy-pvp');
const bossId = ref('');
const nameRows = ref<LadderRow[]>([]);
const pveRows = ref<PveLadderRow[]>([]);
const error = ref('');

const pveMods = computed(() => mods.value.filter((m) => m.bosses && m.bosses.length > 0));
const activeBosses = computed(() => pveMods.value.find((m) => m.id === modId.value)?.bosses ?? []);

onMounted(async () => {
  try {
    mods.value = await api.mods();
    if (!mods.value.some((m) => m.id === modId.value)) modId.value = mods.value[0]?.id ?? 'normal-pvp';
    await refresh();
  } catch (e) {
    error.value = (e as Error).message;
  }
});

function switchMod(id: string) {
  modId.value = id;
  const bosses = pveMods.value.find((m) => m.id === id)?.bosses ?? [];
  if (!bosses.some((b) => b.id === bossId.value)) bossId.value = bosses[0]?.id ?? '';
  void refresh();
}

async function refresh() {
  error.value = '';
  try {
    if (mode.value === 'name') {
      nameRows.value = await api.ladder(modId.value, 1);
    } else {
      if (!bossId.value) {
        pveRows.value = [];
        return;
      }
      pveRows.value = await api.pveLadder(modId.value, bossId.value);
    }
  } catch (e) {
    error.value = (e as Error).message;
  }
}

// keep-alive：每次切回天梯页都刷新
onActivated(() => {
  if (mods.value.length) void refresh();
});

function medal(i: number): string {
  return ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`;
}

function modName(id: string): string {
  return mods.value.find((m) => m.id === id)?.name ?? id;
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">🏆 排行榜</div>
    <div class="row" style="margin-bottom: 10px; flex-wrap: wrap">
      <button class="btn small" :class="{ primary: mode === 'name' }" @click="((mode = 'name'), refresh())">名字天梯</button>
      <button class="btn small" :class="{ primary: mode === 'pve' }" @click="((mode = 'pve'), refresh())">讨伐榜</button>
    </div>

    <div class="row" style="margin-bottom: 10px; flex-wrap: wrap">
      <button
        v-for="m in (mode === 'name' ? mods : pveMods)"
        :key="m.id"
        class="btn small"
        :class="{ primary: m.id === modId }"
        @click="switchMod(m.id)"
      >
        {{ m.name }}
      </button>
    </div>

    <!-- 讨伐榜：Boss 选择 -->
    <div v-if="mode === 'pve'" class="row" style="margin-bottom: 10px; flex-wrap: wrap">
      <select v-model="bossId" class="input" style="width: 200px" @change="refresh()">
        <option value="" disabled>选择 Boss…</option>
        <option v-for="b in activeBosses" :key="b.id" :value="b.id">{{ b.title }} · {{ b.name }}</option>
      </select>
      <span class="muted">胜利优先；胜比行动少，败比撑得久</span>
    </div>

    <div v-if="mode === 'name'" class="muted" style="margin-bottom: 8px">
      同名永远同角色——这个榜就是全服的挖名字藏宝图
    </div>

    <div v-if="error" class="error-text">{{ error }}</div>

    <!-- 名字天梯表 -->
    <table v-if="mode === 'name' && nameRows.length" class="list">
      <thead>
        <tr>
          <th>#</th>
          <th>名字</th>
          <th>场次</th>
          <th>胜/负</th>
          <th>胜率</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in nameRows" :key="r.name">
          <td>{{ medal(i) }}</td>
          <td><b>{{ r.name }}</b></td>
          <td>{{ r.battles }}</td>
          <td>{{ r.wins }}/{{ r.losses }}</td>
          <td><b>{{ Math.round(r.winrate * 100) }}%</b></td>
        </tr>
      </tbody>
    </table>
    <div v-if="mode === 'name' && nameRows.length === 0" class="muted empty">还没有数据，打几场就有了</div>

    <!-- 讨伐榜表 -->
    <table v-if="mode === 'pve' && pveRows.length" class="list">
      <thead>
        <tr>
          <th>#</th>
          <th>讨伐队</th>
          <th>所属</th>
          <th>结果</th>
          <th>行动</th>
          <th>分数</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in pveRows" :key="r.battleId + i">
          <td>{{ medal(i) }}</td>
          <td><b>{{ r.teamNames.join(' · ') }}</b></td>
          <td class="muted">{{ r.owner }}</td>
          <td>
            <span :class="r.win ? 'pos' : 'neg'">{{ r.win ? '🏆 讨伐成功' : '💀 讨伐失败' }}</span>
          </td>
          <td>{{ r.actions }}</td>
          <td>{{ r.score }}</td>
        </tr>
      </tbody>
    </table>
    <div v-if="mode === 'pve' && pveRows.length === 0" class="muted empty">
      {{ bossId ? '这个 Boss 还没人挑战过' : '先选一个 Boss' }}（{{ modName(modId) }}）
    </div>
  </div>
</template>
