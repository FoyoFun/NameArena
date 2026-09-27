<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useRoute } from 'vue-router';
import { getMod, simulate, validateName } from '@namearena/core';
import type { BattleConfig, BattleEvent } from '@namearena/core';
import { api, type BattleRecordDto } from '../api';
import { setLastBattlePath } from '../battleNav';
import { sequencer } from '../battle-stage/sequencer';
import BattleStage from '../battle-stage/BattleStage.vue';
import BattleLog from '../battle-stage/BattleLog.vue';

const route = useRoute();
const error = ref('');
const loading = ref(true);
const modId = ref('normal-pvp');
const speed = ref(1);
const copied = ref(false);

const mod = computed(() => {
  try {
    return getMod(modId.value);
  } catch {
    return null;
  }
});

let lastEvents: BattleEvent[] = [];
/** 当前已加载战斗的路由 key（同路径 = 同一场，恢复回放不重开） */
let lastKey = '';

async function startFromId(id: string): Promise<void> {
  const record: BattleRecordDto = await api.battle(id);
  modId.value = record.config.modId;
  const m = getMod(record.config.modId);
  const { events } = simulate(m, record.config, record.seed);
  lastEvents = events;
  lastKey = route.fullPath;
  setLastBattlePath(route.fullPath);
  loading.value = false;
  void sequencer.play(events);
}

/** 本地快斗：种子掺时间戳，每次都是新战斗 */
function startLocalBattle(): void {
  const q = route.query as { a?: string; b?: string; modId?: string };
  modId.value = (q.modId as string) ?? 'normal-pvp';
  const m = getMod(modId.value);
  const parse = (s?: string) =>
    (s ?? '')
      .split(/[,，]/)
      .map((x) => x.trim())
      .filter(Boolean);
  const aNames = parse(q.a);
  const bNames = parse(q.b);
  for (const n of [...aNames, ...bNames]) {
    const v = validateName(n);
    if (!v.ok) throw new Error(v.reason);
  }
  const config: BattleConfig = {
    modId: modId.value,
    kind: 'async',
    teams: [
      { side: 'A', units: aNames.map((name) => ({ name, side: 'A' })) },
      { side: 'B', units: bNames.map((name) => ({ name, side: 'B' })) },
    ],
  };
  const err = m.team.validateTeams(config.teams);
  if (err) throw new Error(err);
  const { events } = simulate(m, config, (Date.now() ^ 0x5f5f5f5f) >>> 0);
  lastEvents = events;
  lastKey = route.fullPath;
  setLastBattlePath(route.fullPath);
  loading.value = false;
  void sequencer.play(events);
}

async function syncFromRoute(): Promise<void> {
  try {
    error.value = '';
    // 同一路径 = 同一场战斗：恢复当前回放进度，不重开。
    // 「重新打一场」由入口按钮负责（快斗带时间戳参数、讨伐走新 id）。
    const key = route.fullPath;
    if (key === lastKey && lastEvents.length > 0) return;
    loading.value = true;
    if (route.name === 'battle-local') {
      startLocalBattle();
    } else {
      await startFromId(route.params.id as string);
    }
  } catch (e) {
    error.value = (e as Error).message;
    loading.value = false;
  }
}

onMounted(() => {
  void syncFromRoute();
});

// keep-alive：从页签/导航回来时，同一场继续看，不同场才加载
onActivated(() => {
  void syncFromRoute();
});
watch(
  () => route.fullPath,
  () => {
    if (route.name === 'battle' || route.name === 'battle-local') void syncFromRoute();
  },
);

async function replay() {
  sequencer.setSpeed(speed.value);
  await sequencer.play(lastEvents);
}

function toggleSpeed() {
  speed.value = speed.value === 1 ? 2 : speed.value === 2 ? 4 : 1;
  sequencer.setSpeed(speed.value);
}

function skip() {
  sequencer.skip();
}

async function copyReport() {
  const text = sequencer.state.log.map((l) => l.text).join('\n');
  try {
    await navigator.clipboard.writeText(text);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    copied.value = true;
    setTimeout(() => (copied.value = false), 1500);
  }
}

const resultText = computed(() => {
  const r = sequencer.state.result;
  if (!r) return '';
  const units = sequencer.state.units;
  const winnerNames = r.winner ? units.filter((u) => u.side === r.winner).map((u) => u.name).join('、') : '';
  if (!r.winner) return `🤝 平局（${r.rounds} 回合）`;
  const reason = r.reason === 'wipe' ? '全歼' : '判定';
  return `🏆 ${winnerNames} 获胜（${reason}，${r.rounds} 回合）`;
});
</script>

<template>
  <div v-if="error" class="panel error-text">{{ error }}</div>
  <div v-else-if="loading" class="muted empty">加载战报…</div>
  <template v-else-if="mod">
    <div class="panel" style="display: flex; gap: 8px; align-items: center; justify-content: space-between">
      <div class="row">
        <button class="btn small" @click="replay">🔄 重播</button>
        <button class="btn small" @click="toggleSpeed">{{ speed }}x</button>
        <button class="btn small" @click="skip">⏭ 跳过</button>
      </div>
      <button class="btn small primary" @click="copyReport">{{ copied ? '✓ 已复制' : '📋 复制战报' }}</button>
    </div>

    <div v-if="sequencer.state.finished && sequencer.state.result" class="panel result-banner">
      {{ resultText }}
    </div>

    <BattleStage :stats-meta="mod.stats" />

    <div class="panel" style="margin-top: 12px">
      <BattleLog />
    </div>
  </template>
</template>
