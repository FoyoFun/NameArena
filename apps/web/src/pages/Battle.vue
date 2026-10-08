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
import GameIcon from '../components/GameIcon.vue';
import PageHero from '../components/PageHero.vue';

const route = useRoute();
const error = ref('');
const loading = ref(true);
const modId = ref('fantasy-pvp');
const speed = ref(1);

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
  void sequencer.play(events, m.display);
}

/** 本地快斗：种子掺时间戳，每次都是新战斗。fantasy 支持从取名实验室带来性别/职业选择（ga/ja/gb/jb） */
function startLocalBattle(): void {
  const q = route.query as { a?: string; b?: string; modId?: string; ga?: string; ja?: string; gb?: string; jb?: string };
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
  const optsOf = (g?: string, j?: string): Record<string, unknown> | undefined => {
    const opts: Record<string, unknown> = {};
    if (g) opts['gender'] = g;
    if (j) opts['jobId'] = j;
    return Object.keys(opts).length ? opts : undefined;
  };
  const aOpts = optsOf(q.ga, q.ja);
  const bOpts = optsOf(q.gb, q.jb);
  const config: BattleConfig = {
    modId: modId.value,
    kind: 'async',
    teams: [
      { side: 'A', units: aNames.map((name) => ({ name, side: 'A', opts: aOpts })) },
      { side: 'B', units: bNames.map((name) => ({ name, side: 'B', opts: bOpts })) },
    ],
  };
  const err = m.team.validateTeams(config.teams);
  if (err) throw new Error(err);
  const { events } = simulate(m, config, (Date.now() ^ 0x5f5f5f5f) >>> 0);
  lastEvents = events;
  lastKey = route.fullPath;
  setLastBattlePath(route.fullPath);
  loading.value = false;
  void sequencer.play(events, m.display);
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
  await sequencer.play(lastEvents, mod.value?.display ?? undefined);
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
  const unit = mod.value?.display.roundLabel ?? '回合';
  if (!r.winner) return `🤝 平局（${r.rounds} ${unit}）`;
  const reason = r.reason === 'wipe' ? '全歼' : '判定';
  return `🏆 ${winnerNames} 获胜（${reason}，${r.rounds} ${unit}）`;
});
</script>

<template>
  <div v-if="error" class="panel error-text">{{ error }}</div>
  <div v-else-if="loading" class="muted empty">加载战报…</div>
  <template v-else-if="mod">
    <!-- 战斗页一屏布局（决策 #59）：上方舞台区吃剩余高度（两阵营各自内滚），
         战报无论如何保底 40%——展开技能也不会把战报挤没 -->
    <div class="battle-wrap">
      <PageHero icon="swords" title="战斗">
        <button class="btn small icon-btn" title="从头重播" @click="replay"><GameIcon name="play" :size="13" /></button>
        <button class="btn small" title="播放速度" @click="toggleSpeed"><GameIcon name="speed" :size="13" />{{ speed }}x</button>
        <button class="btn small icon-btn" title="瞬间补完" @click="skip"><GameIcon name="skip" :size="13" /></button>
        <span v-if="sequencer.state.cap" class="tag gold" title="当前已用行动数 / 最大行动数">
          <GameIcon name="clock" :size="11" />{{ sequencer.state.actions }}/{{ sequencer.state.cap }}
        </span>
      </PageHero>

      <div v-if="sequencer.state.finished && sequencer.state.result" class="panel result-banner">
        {{ resultText }}
      </div>

      <div class="battle-top">
        <BattleStage :stats-meta="mod.stats" :display="mod.display" />
      </div>

      <div class="log-panel">
        <BattleLog class="log-fill" />
      </div>
    </div>
  </template>
</template>

<style scoped>
.log-panel {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.log-fill {
  flex: 1;
}

/* icon-only 按钮：正方形 */
.icon-btn {
  width: 30px;
  padding: 0;
  justify-content: center;
}

/* 移动端（决策 #61）：同样一屏定高——战报固定底部 40%，舞台 60% 内滚 */
@media (max-width: 899px) {
  .battle-wrap {
    display: flex;
    flex-direction: column;
    gap: 8px;
    height: calc(100dvh - var(--nav-h) - 20px);
  }

  .battle-top {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .log-panel {
    flex: 0 0 40%;
    min-height: 0;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 4px;
  }

  .log-fill {
    max-height: none;
  }
}

/* 桌面：一屏放下所有信息。舞台区吃剩余高度（两阵营各自内滚），
   战报保底 40% 不被挤压（决策 #59） */
@media (min-width: 900px) {
  .battle-wrap {
    display: flex;
    flex-direction: column;
    gap: 10px;
    height: calc(100vh - 28px - 40px); /* .page 的上下 padding */
  }

  .battle-top {
    flex: 1 1 auto;
    min-height: 0;
    display: flex;
    flex-direction: column;
  }

  .log-panel {
    flex: 0 0 40%;
    min-height: 0;
    background: var(--panel);
    border: 1px solid var(--border);
    border-radius: var(--radius);
    padding: 6px 4px;
  }

  .log-fill {
    max-height: none;
  }
}
</style>
