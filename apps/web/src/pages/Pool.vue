<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { useRouter } from 'vue-router';
import { api, type ModInfo, type TeamInfo } from '../api';
import { fantasySeed, getMod, makeRng, nameSeed, validateName } from '@namearena/core';
import CharacterPanel from '../components/CharacterPanel.vue';
import GameIcon from '../components/GameIcon.vue';
import PageHero from '../components/PageHero.vue';
import PageTabs from '../components/PageTabs.vue';
import { useMode } from '../mode';

const router = useRouter();
const { activeMode } = useMode();
const activeMod = computed(() => activeMode.value?.id ?? 'fantasy-pvp');

const mods = ref<ModInfo[]>([]);
const pool = ref<TeamInfo[]>([]);
const myTeams = ref<TeamInfo[]>([]);
const attackerId = ref('');
const selfA = ref('');
const selfB = ref('');
const busy = ref(false);
const error = ref('');

// ---- 创建队伍（原「我的队伍」页，决策 #68 并入本页）----

/** 每行的生成选项（fantasy 用；'' = 随机。F52 起职业不可选） */
const members = ref<string[]>([]);
const memberGenders = ref<string[]>([]);
const createError = ref('');
const createBusy = ref(false);
/** 当前展开详情的队伍 id（'' = 无） */
const expanded = ref('');

const isPve = computed(() => activeMod.value.endsWith('-pve'));
const isFantasy = computed(() => activeMod.value.startsWith('fantasy'));
const mod = computed(() => mods.value.find((m) => m.id === activeMod.value));
/** 同一生成域（如 fantasy-pvp / fantasy-pve）的队伍可互相出战——角色相同，无需重复建队 */
const genKeyOf = (id: string) => id.replace(/-(pvp|pve)$/, '');
const myModTeams = computed(() => myTeams.value.filter((t) => genKeyOf(t.modId) === genKeyOf(activeMod.value)));
/** 生成域上限：卡片数量随模组（PVP 5 人 / PVE 8 人由 mods 下发） */
const maxUnits = computed(() => members.value.length);

/** 移动端二级页签：创建队伍 / 我的队伍 / 开打（桌面全块同显，页签隐藏） */
const mobileTab = ref<'create' | 'teams' | 'fight'>('create');

onMounted(async () => {
  mods.value = await api.mods();
  await resetForMode();
  await refresh();
});

// keep-alive：切页回来刷新数据，保留表单与所选 tab；并复位挑战按钮
onActivated(async () => {
  busy.value = false;
  if (mods.value.length) await refresh();
});

// 模式切换（侧栏）→ 换生成域：重建建队表单并刷新
watch(activeMod, async (id, old) => {
  if (id && id !== old) {
    if (!mods.value.length) mods.value = await api.mods();
    attackerId.value = '';
    await resetForMode();
    await refresh();
  }
});

async function resetForMode() {
  if (!activeMod.value) return;
  const max = mods.value.find((m) => m.id === activeMod.value)?.maxUnits ?? 5;
  members.value = Array.from({ length: max }, () => '');
  memberGenders.value = Array.from({ length: max }, () => '');
  createError.value = '';
  expanded.value = '';
}

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

const validMembers = computed(() =>
  members.value.map((m) => (m.trim() === '' ? null : validateName(m))),
);

const filled = computed(() => validMembers.value.filter((v) => v !== null) as { ok: true; name: string }[]);

function rowOpts(i: number): Record<string, unknown> | undefined {
  const opts: Record<string, unknown> = {};
  if (memberGenders.value[i]) opts['gender'] = memberGenders.value[i];
  return Object.keys(opts).length ? opts : undefined;
}

/** 队伍详情展开：按队伍所属模组与其保存的选项重算角色（同名同选同域同版本必同角色） */
function previewChar(modId: string, name: string, opts: Record<string, unknown> | null): unknown {
  const m = getMod(modId);
  const v = validateName(name);
  const o = (opts ?? undefined) as Parameters<typeof fantasySeed>[3] | undefined;
  const seed = modId.startsWith('fantasy')
    ? fantasySeed(v.name, m.genKey, m.genVersion, o)
    : nameSeed(v.name, m.genKey, m.genVersion);
  return m.generateCharacter(makeRng(seed), { name: v.name, opts: o as Record<string, unknown> | undefined });
}

function checkCreate(): string {
  if (filled.value.length === 0) return '至少填 1 名队员';
  if (filled.value.length > maxUnits.value) return `最多 ${maxUnits.value} 人`;
  for (const v of validMembers.value) {
    if (v && !v.ok) return v.reason;
  }
  return '';
}

async function create() {
  const err = checkCreate();
  if (err) {
    createError.value = err;
    return;
  }
  createError.value = '';
  createBusy.value = true;
  try {
    const payload = members.value
      .map((name, i) => ({ name: name.trim(), opts: rowOpts(i) }))
      .filter((m) => m.name !== '')
      .map((m) => (m.opts ? { name: m.name, opts: m.opts } : m.name));
    await api.createTeam(activeMod.value, payload);
    members.value = members.value.map(() => '');
    memberGenders.value = memberGenders.value.map(() => '');
    await refresh();
  } catch (e) {
    createError.value = (e as Error).message;
  } finally {
    createBusy.value = false;
  }
}

async function remove(id: string) {
  if (!confirm('确定解散这支队伍？')) return;
  try {
    await api.deleteTeam(id);
    if (expanded.value === id) expanded.value = '';
    await refresh();
  } catch (e) {
    alert('解散失败：' + (e as Error).message);
  }
}

function toggleExpand(id: string) {
  expanded.value = expanded.value === id ? '' : id;
}

/** 展开队伍的详情数据（列表里找不到时返回 null，模板据此不渲染） */
const expandedTeam = computed(() => myModTeams.value.find((t) => t.id === expanded.value) ?? null);

// ---- 开打：互斗 / 挑战 / 讨伐 ----

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
  <PageHero icon="arena" :title="isPve ? '讨伐' : '竞技场'" subtitle="建队、互斗、挑战与讨伐都在这里；异步对战对方不在线也能打">
    <button class="btn small" @click="refresh()"><GameIcon name="refresh" :size="12" />刷新</button>
  </PageHero>

  <PageTabs
    v-model="mobileTab"
    class="mobile-only"
    :tabs="[
      { key: 'create', label: '创建队伍', icon: 'sparkles' },
      { key: 'teams', label: '我的队伍', icon: 'team' },
      { key: 'fight', label: isPve ? '讨伐' : '开打', icon: 'swords' },
    ]"
  />

  <!-- 块一：创建队伍（横向成员卡带，原「我的队伍」页） -->
  <div class="panel gold" :class="{ 'mobile-hide': mobileTab !== 'create' }">
    <div class="panel-head">
      <span class="t"><GameIcon name="sparkles" :size="14" />创建队伍</span>
      <span class="acts">
        <span class="tag">{{ filled.length }}/{{ maxUnits }} 人</span>
        <button class="btn small primary" :disabled="createBusy" @click="create">
          <GameIcon name="check" :size="12" />创建队伍
        </button>
      </span>
    </div>

    <div class="hstrip">
      <div v-for="(m, i) in members" :key="i" class="member-card">
        <div class="member-idx">队员 {{ i + 1 }}</div>
        <input v-model="members[i]" class="input" :placeholder="`名字（可留空）`" maxlength="40" />
        <span v-if="m.trim() && !validateName(m).ok" class="error-text">名字不合法</span>
        <template v-if="isFantasy">
          <select v-model="memberGenders[i]" class="input">
            <option value="">性别随机</option>
            <option value="male">♂ 男</option>
            <option value="female">♀ 女</option>
          </select>
        </template>
      </div>
    </div>
    <div v-if="createError" class="error-text" style="margin-top: 6px">{{ createError }}</div>
  </div>

  <!-- 块二：我的队伍（列表 + 详情展开） -->
  <div class="panel team-panel" :class="{ 'mobile-hide': mobileTab !== 'teams' }">
    <div class="panel-head">
      <span class="t"><GameIcon name="team" :size="14" />我的队伍</span>
      <span class="acts">
        <span class="tag">{{ myModTeams.length }} 支</span>
        <span class="muted" style="font-size: 12px">点击卡片展开成员详情</span>
      </span>
    </div>

    <div class="hstrip">
      <div
        v-for="t in myModTeams"
        :key="t.id"
        class="team-card"
        :class="{ open: expanded === t.id }"
        @click="toggleExpand(t.id)"
      >
        <div class="team-card-names">
          <b v-for="n in t.members" :key="n" class="team-name-chip">{{ n }}</b>
        </div>
        <div class="team-card-meta">
          <span class="tag" :class="t.wins + t.losses > 0 ? (t.wins >= t.losses ? 'ok' : 'bad') : ''">
            {{ t.wins }}胜 {{ t.losses }}负
          </span>
          <span v-if="t.inPool" class="tag">已入池</span>
        </div>
        <div class="team-card-acts">
          <button class="btn small" @click.stop="toggleExpand(t.id)">
            {{ expanded === t.id ? '收起' : '详情' }}
          </button>
          <button class="btn small danger" @click.stop="remove(t.id)"><GameIcon name="cross" :size="12" />解散</button>
        </div>
      </div>
      <div v-if="myModTeams.length === 0" class="muted empty strip-empty">
        这个模式还没有队伍——在上方「创建队伍」里填几个名字
      </div>
    </div>

    <!-- 选中详情：成员横排，区内垂直滚动 -->
    <div v-if="expandedTeam" class="team-detail">
      <div v-for="(name, i) in expandedTeam.members" :key="name" class="detail-member">
        <CharacterPanel
          v-if="validateName(name).ok"
          :char="previewChar(expandedTeam.modId, name, expandedTeam.memberOpts?.[i] ?? null)"
          :mod-id="expandedTeam.modId"
        />
      </div>
    </div>
  </div>

  <!-- ================ PVP：互斗 / 与他人 PK ================ -->
  <template v-if="!isPve">
    <!-- 块三：我的队伍互斗（独立功能，不依赖出战条） -->
    <div class="panel" :class="{ 'mobile-hide': mobileTab !== 'fight' }">
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
      <div v-if="myModTeams.length === 0" class="muted" style="margin-top: 6px">还没有队伍，先在上面「创建队伍」建一支</div>
    </div>

    <!-- 块四：与他人 PK——出战条统御下方数据池 -->
    <div class="panel info" :class="{ 'mobile-hide': mobileTab !== 'fight' }">
      <div class="panel-head">
        <span class="t"><GameIcon name="swords" :size="14" />与他人 PK</span>
        <span class="acts"><span class="muted" style="font-size: 12px">打完双方都记入战绩</span></span>
      </div>

      <div class="pick-row">
        <span class="pick-label"><GameIcon name="user" :size="14" />出战队伍</span>
        <select v-model="attackerId" class="input" style="flex: 1; min-width: 180px">
          <option value="" disabled>选择你的队伍</option>
          <option v-for="t in myModTeams" :key="t.id" :value="t.id">
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

  <!-- ================ PVE：出战 / 强敌 ================ -->
  <template v-else>
    <!-- 块五：出战队伍 -->
    <div class="panel info" :class="{ 'mobile-hide': mobileTab !== 'fight' }">
      <div class="panel-head">
        <span class="t"><GameIcon name="user" :size="14" />出战队伍</span>
        <span class="acts"><span class="muted" style="font-size: 12px">最多可带 {{ mod?.maxUnits }} 人，人数不足不补，多打少是勇士的浪漫</span></span>
      </div>
      <div class="row" style="flex-wrap: nowrap; min-width: 0">
        <select v-model="attackerId" class="input" style="flex: 1; min-width: 180px">
          <option value="" disabled>选择你的 PVE 队伍</option>
          <option v-for="t in myModTeams" :key="t.id" :value="t.id">
            {{ t.members.join(' · ') }}（{{ t.wins }}胜{{ t.losses }}负）
          </option>
        </select>
      </div>
      <div v-if="error" class="error-text" style="margin-top: 6px">{{ error }}</div>
    </div>

    <!-- 块六：PVE 强敌 -->
    <div class="panel danger" :class="{ 'mobile-hide': mobileTab !== 'fight' }">
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
/* 移动端二级页签切换：非当前块隐藏（!important 防 display:flex 覆盖）；
   桌面（≥900px）无此规则，全部块自然同显 */
@media (max-width: 899px) {
  .mobile-hide {
    display: none !important;
  }
}

/* 横排卡片带：超出可水平滚动（主人裁定：优先垂直，但以排版美观为主，横向带子允许横滚） */
.hstrip {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  overflow-y: hidden;
  padding-bottom: 4px;
}

.member-card {
  flex: 0 0 148px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 8px;
}

.member-idx {
  font-size: 11px;
  font-weight: 700;
  color: var(--faint);
  letter-spacing: 0.06em;
}

.team-panel {
  min-width: 0;
}

.team-card {
  flex: 0 0 210px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 8px 10px;
  cursor: pointer;
  transition: border-color var(--dur-1) var(--ease-out);
}

.team-card:hover {
  border-color: var(--border-strong);
}

.team-card.open {
  border-color: rgba(243, 183, 96, 0.4);
}

.team-card-names {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.team-name-chip {
  font-size: 12px;
  background: rgba(255, 255, 255, 0.06);
  border: 1px solid var(--border-soft);
  border-radius: 4px;
  padding: 0 5px;
  line-height: 1.6;
}

.team-card-meta {
  display: flex;
  gap: 4px;
  flex-wrap: wrap;
}

.team-card-acts {
  display: flex;
  gap: 4px;
  margin-top: auto;
}

.team-card-acts .btn {
  flex: 1;
}

.strip-empty {
  flex: 1;
  min-width: 200px;
}

/* 详情区：成员横排 + 垂直滚动 */
.team-detail {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: minmax(250px, 1fr);
  gap: 8px;
  max-height: 62vh;
  overflow-y: auto;
  overflow-x: auto;
}

.detail-member {
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 8px;
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
