<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api, type ModInfo, type TeamInfo } from '../api';
import GameIcon from '../components/GameIcon.vue';
import PageHero from '../components/PageHero.vue';
import PageTabs from '../components/PageTabs.vue';
import { useMode } from '../mode';

const router = useRouter();
const { activeMode } = useMode();
const activeMod = computed(() => activeMode.value?.id ?? 'fantasy-pvp');

const pool = ref<TeamInfo[]>([]);
const myTeams = ref<TeamInfo[]>([]);
const attackerId = ref('');
const selfA = ref('');
const selfB = ref('');
const busy = ref(false);
const error = ref('');
/** 移动端二级页签：PVP=互斗/挑战，PVE=出战/强敌（桌面双块同显，页签隐藏） */
const pvpTab = ref<'fight' | 'pk'>('fight');
const pveTab = ref<'pick' | 'boss'>('pick');

const isPve = computed(() => activeMod.value.endsWith('-pve'));
const mod = computed(() => mods.value.find((m) => m.id === activeMod.value));
const mods = ref<ModInfo[]>([]);
/** 同一生成域（如 fantasy-pvp / fantasy-pve）的队伍可互相出战——角色相同，无需重复建队 */
const genKeyOf = (id: string) => id.replace(/-(pvp|pve)$/, '');
const myModTeams = computed(() => myTeams.value.filter((t) => genKeyOf(t.modId) === genKeyOf(activeMod.value)));

onMounted(async () => {
  mods.value = await api.mods();
  await refresh();
});

// keep-alive：切页回来刷新数据，保留所选 tab / 出战队伍；并复位挑战按钮
onActivated(async () => {
  busy.value = false;
  if (mods.value.length) await refresh();
});

// 模式切换（侧栏）→ 换生成域刷新
watch(activeMod, async (id, old) => {
  if (id && id !== old) {
    if (!mods.value.length) mods.value = await api.mods();
    attackerId.value = '';
    await refresh();
  }
});

async function refresh() {
  [pool.value, myTeams.value] = await Promise.all([
    api.pool(activeMod.value).catch(() => []),
    api.myTeams(),
  ]);
  const mine = myModTeams.value;
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
  <PageHero icon="arena" :title="isPve ? '讨伐' : '竞技场'" subtitle="选好队伍随时开打；异步对战对方不在线也能打">
    <button class="btn small" @click="refresh()"><GameIcon name="refresh" :size="12" />刷新</button>
  </PageHero>

  <PageTabs
      v-if="!isPve"
      v-model="pvpTab"
      class="mobile-only"
      :tabs="[
        { key: 'fight', label: '我的队伍互斗', icon: 'clash' },
        { key: 'pk', label: '与他人 PK', icon: 'swords' },
      ]"
    />
    <PageTabs
      v-if="isPve"
      v-model="pveTab"
      class="mobile-only"
      :tabs="[
        { key: 'pick', label: '出战队伍', icon: 'user' },
        { key: 'boss', label: 'PVE 强敌', icon: 'skull' },
      ]"
    />

  <template v-if="!isPve">
    <!-- 块一：我的队伍互斗（独立功能，不依赖出战条） -->
    <div class="panel" :class="{ 'mobile-hide': pvpTab !== 'fight' }">
      <div class="panel-head">
        <span class="t"><GameIcon name="clash" :size="14" />我的队伍互斗</span>
        <span class="acts"><span class="muted" style="font-size: 12px">左边捶右边，不计入数据池门槛</span></span>
      </div>
      <div class="self-fight">
        <select v-model="selfA" class="input" style="flex: 1; min-width: 140px">
          <option v-for="t in myModTeams" :key="t.id" :value="t.id">{{ teamLabel(t.id) }}</option>
        </select>
        <span class="vs-chip">VS</span>
        <select v-model="selfB" class="input" style="flex: 1; min-width: 140px">
          <option v-for="t in myModTeams" :key="t.id" :value="t.id">{{ teamLabel(t.id) }}</option>
        </select>
        <button class="btn primary" :disabled="busy || myModTeams.length < (selfA === selfB ? 1 : 2)" @click="selfBattle">
          <GameIcon name="swords" :size="14" />开打
        </button>
      </div>
      <div v-if="myModTeams.length === 0" class="muted" style="margin-top: 6px">还没有队伍，先去「我的队伍」建一支</div>
    </div>

    <!-- 块二：与他人 PK——出战条统御下方数据池 -->
    <div class="panel info" :class="{ 'mobile-hide': pvpTab !== 'pk' }">
      <div class="panel-head">
        <span class="t"><GameIcon name="swords" :size="14" />与他人 PK</span>
        <span class="acts"><span class="muted" style="font-size: 12px">打完双方都记入战绩</span></span>
      </div>

      <div class="pick-row">
        <span class="pick-label"><GameIcon name="user" :size="14" />出战队伍</span>
        <select v-model="attackerId" class="input" style="flex: 1; min-width: 180px">
          <option value="" disabled>选择你的队伍</option>
          <option v-for="t in myTeams.filter((x) => x.modId === activeMod)" :key="t.id" :value="t.id">
            {{ t.members.join(' · ') }}（{{ t.wins }}胜{{ t.losses }}负）
          </option>
        </select>
      </div>

      <div class="pool-head">
        <span class="muted" style="font-size: 12px">挑战别人用过的队伍，对方不在线也能打</span>
        <span class="tag">{{ pool.length }} 支离线队伍</span>
      </div>
      <div class="scroll-y pool-scroll">
        <div v-for="t in pool" :key="t.id" class="list-row">
          <div style="min-width: 0">
            <b style="font-size: 13px">{{ t.members.join(' · ') }}</b>
            <div class="muted" style="font-size: 11px">
              {{ t.owner }} ·
              <span :class="t.wins >= t.losses ? 'v-pos' : 'v-neg'">{{ t.wins }}胜{{ t.losses }}负</span>
              · 胜率 {{ winrate(t) }}
            </div>
          </div>
          <button class="btn small primary" :disabled="busy" @click="challenge(t.id)">挑战</button>
        </div>
        <div v-if="pool.length === 0" class="muted empty">
          池子还空着——先去打几场，或者等群友的队伍入池
        </div>
      </div>
    </div>
  </template>

  <template v-else>
    <!-- PVE：出战条统御下方 Boss 卡 -->
    <div class="panel info" :class="{ 'mobile-hide': pveTab !== 'pick' }">
      <div class="panel-head">
        <span class="t"><GameIcon name="user" :size="14" />出战队伍</span>
        <span class="acts"><span class="muted" style="font-size: 12px">最多可带 {{ mod?.maxUnits }} 人，人数不足不补，多打少是勇士的浪漫</span></span>
      </div>
      <div class="row" style="flex-wrap: nowrap; min-width: 0">
        <select v-model="attackerId" class="input" style="flex: 1; min-width: 180px">
          <option value="" disabled>选择你的 PVE 队伍</option>
          <option v-for="t in myTeams.filter((x) => x.modId === activeMod)" :key="t.id" :value="t.id">
            {{ t.members.join(' · ') }}（{{ t.wins }}胜{{ t.losses }}负）
          </option>
        </select>
      </div>
      <div v-if="error" class="error-text" style="margin-top: 6px">{{ error }}</div>
    </div>

    <div class="panel danger" :class="{ 'mobile-hide': pveTab !== 'boss' }">
      <div class="panel-head">
        <span class="t"><GameIcon name="skull" :size="14" />PVE 强敌</span>
        <span class="acts"><span class="muted" style="font-size: 12px">选出战队伍后点「讨伐」开战</span></span>
      </div>
      <div class="cardgrid">
        <div v-for="b in mod?.bosses ?? []" :key="b.id" class="boss-card">
          <div class="boss-top">
            <GameIcon name="skull" :size="18" />
            <div style="min-width: 0">
              <b style="font-size: 14px">{{ b.name }}</b>
              <div class="tag gold" style="margin-top: 2px">{{ b.title }}</div>
            </div>
          </div>
          <div class="boss-desc">{{ b.desc }}</div>
          <button class="btn small primary" style="width: 100%" :disabled="busy" @click="challenge(undefined, b.id)">
            <GameIcon name="swords" :size="13" />讨伐
          </button>
        </div>
      </div>
    </div>
  </template>
</template>

<style scoped>
/* 移动端二级页签切换（!important 防 display:flex 覆盖）；桌面双块同显 */
@media (max-width: 899px) {
  .mobile-hide {
    display: none !important;
  }
}

.self-fight {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: wrap;
}

.vs-chip {
  flex: none;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  color: var(--faint);
  border: 1px solid var(--border-soft);
  border-radius: 999px;
  padding: 2px 7px;
}

.pick-row {
  display: flex;
  gap: 8px;
  align-items: center;
  flex-wrap: nowrap;
  min-width: 0;
}

.pick-label {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  color: var(--muted);
  font-size: 13px;
  flex: none;
}

.pool-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin: 8px 0 4px;
}

.pool-scroll {
  max-height: 46vh;
  padding-right: 2px;
}

.boss-card {
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.boss-top {
  display: flex;
  gap: 8px;
  align-items: flex-start;
  color: var(--hp-lo);
}

.boss-desc {
  font-size: 12px;
  color: var(--muted);
  line-height: 1.6;
  flex: 1;
}
</style>
