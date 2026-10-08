<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { api, type LadderRow, type ModInfo, type PveLadderRow } from '../api';
import GameIcon from '../components/GameIcon.vue';
import PageHero from '../components/PageHero.vue';
import { useMode } from '../mode';

const { activeMode } = useMode();
const modId = computed(() => activeMode.value?.id ?? 'fantasy-pvp');

const mods = ref<ModInfo[]>([]);
/** 榜单种类：名字天梯（PVP）/ 讨伐榜（PVE）；默认随当前模式 */
const board = ref<'name' | 'pve'>('name');
const bossId = ref('');
const nameRows = ref<LadderRow[]>([]);
const pveRows = ref<PveLadderRow[]>([]);
const error = ref('');

const pveMods = computed(() => mods.value.filter((m) => m.bosses && m.bosses.length > 0));
const activeBosses = computed(() => pveMods.value.find((m) => m.id === modId.value)?.bosses ?? []);

onMounted(async () => {
  try {
    mods.value = await api.mods();
    syncBoardFromMode();
    await refresh();
  } catch (e) {
    error.value = (e as Error).message;
  }
});

// keep-alive：每次切回天梯页都刷新
onActivated(() => {
  if (mods.value.length) void refresh();
});

// 模式切换（侧栏）→ 榜单种类与生成域跟随
watch(modId, async (id, old) => {
  if (id && id !== old && mods.value.length) {
    syncBoardFromMode();
    await refresh();
  }
});

function syncBoardFromMode() {
  const want = activeMode.value?.kind === 'pve' ? 'pve' : 'name';
  if (board.value !== want) board.value = want;
  const bosses = pveMods.value.find((m) => m.id === modId.value)?.bosses ?? [];
  if (!bosses.some((b) => b.id === bossId.value)) bossId.value = bosses[0]?.id ?? '';
}

async function refresh() {
  error.value = '';
  try {
    if (board.value === 'name') {
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

function medal(i: number): string {
  return ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`;
}

function modName(id: string): string {
  return mods.value.find((m) => m.id === id)?.name ?? id;
}
</script>

<template>
  <PageHero icon="ladder" :title="board === 'pve' ? '讨伐榜' : '排行榜'" subtitle="同名永远同角色——名字天梯就是全服的挖名字藏宝图">
    <button class="btn small" :class="{ primary: board === 'name' }" @click="((board = 'name'), refresh())">
      <GameIcon name="lab" :size="12" />名字天梯
    </button>
    <button class="btn small" :class="{ primary: board === 'pve' }" @click="((board = 'pve'), refresh())">
      <GameIcon name="skull" :size="12" />讨伐榜
    </button>
  </PageHero>

  <div class="panel">
    <div class="panel-head">
      <span class="t"><GameIcon :name="board === 'pve' ? 'trophy' : 'lab'" :size="14" />{{ modName(modId) }}</span>
      <span v-if="board === 'pve'" class="acts">
        <select v-model="bossId" class="input" style="width: 220px" @change="refresh()">
          <option value="" disabled>选择 Boss…</option>
          <option v-for="b in activeBosses" :key="b.id" :value="b.id">{{ b.title }} · {{ b.name }}</option>
        </select>
      </span>
    </div>

    <div v-if="board === 'pve'" class="muted" style="font-size: 12px; margin-bottom: 6px">
      胜利优先；胜比行动少，败比撑得久
    </div>

    <div v-if="error" class="error-text">{{ error }}</div>

    <!-- 名字天梯表（模块内滚动） -->
    <div v-if="board === 'name'" class="scroll-y table-scroll">
      <table v-if="nameRows.length" class="list">
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
            <td><b :class="r.winrate >= 0.5 ? 'v-pos' : ''">{{ Math.round(r.winrate * 100) }}%</b></td>
          </tr>
        </tbody>
      </table>
      <div v-if="nameRows.length === 0" class="muted empty">还没有数据，打几场就有了</div>
    </div>

    <!-- 讨伐榜表（模块内滚动） -->
    <div v-if="board === 'pve'" class="scroll-y table-scroll">
      <table v-if="pveRows.length" class="list">
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
              <span class="tag" :class="r.win ? 'ok' : 'bad'">{{ r.win ? '🏆 讨伐成功' : '💀 讨伐失败' }}</span>
            </td>
            <td>{{ r.actions }}</td>
            <td><b>{{ r.score }}</b></td>
          </tr>
        </tbody>
      </table>
      <div v-if="pveRows.length === 0" class="muted empty">
        {{ bossId ? '这个 Boss 还没人挑战过' : '先选一个 Boss' }}（{{ modName(modId) }}）
      </div>
    </div>
  </div>
</template>

<style scoped>
.table-scroll {
  max-height: 62vh;
}
</style>
