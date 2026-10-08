<script setup lang="ts">
import { computed, onActivated, onMounted, ref, watch } from 'vue';
import { api, type TeamInfo } from '../api';
import { fantasySeed, getMod, JOBS, makeRng, nameSeed, validateName } from '@namearena/core';
import CharacterPanel from '../components/CharacterPanel.vue';
import GameIcon from '../components/GameIcon.vue';
import PageHero from '../components/PageHero.vue';
import PageTabs from '../components/PageTabs.vue';
import { useMode } from '../mode';

const { activeMode } = useMode();
const activeMod = computed(() => activeMode.value?.id ?? '');

const teams = ref<TeamInfo[]>([]);
const members = ref<string[]>([]);
/** 每行的生成选项（fantasy 用；'' = 随机） */
const memberGenders = ref<string[]>([]);
const memberJobs = ref<string[]>([]);
const error = ref('');
const busy = ref(false);
/** 当前展开详情的队伍 id（'' = 无） */
const expanded = ref<string>('');
/** 移动端二级页签：创建队伍 / 队伍列表（桌面双块同显，页签隐藏） */
const mobileTab = ref<'create' | 'list'>('create');

const isFantasy = computed(() => activeMod.value.startsWith('fantasy'));
/** 生成域上限：卡片数量随模组（PVP 5 人 / PVE 8 人由 mods 下发） */
const maxUnits = computed(() => members.value.length);

onMounted(async () => {
  await resetForMode();
  await refresh();
});

// keep-alive：切页回来刷新列表数据，但保留输入框等界面状态
onActivated(async () => {
  if (activeMod.value) await refresh();
});

// 模式切换（侧栏）→ 换生成域重建表单并刷新
watch(activeMod, async (id, old) => {
  if (id && id !== old) {
    await resetForMode();
    await refresh();
  }
});

async function resetForMode() {
  if (!activeMod.value) return;
  const mods = await api.mods().catch(() => []);
  const max = mods.find((m) => m.id === activeMod.value)?.maxUnits ?? 5;
  members.value = Array.from({ length: max }, () => '');
  memberGenders.value = Array.from({ length: max }, () => '');
  memberJobs.value = Array.from({ length: max }, () => '');
  expanded.value = '';
}

async function refresh() {
  teams.value = await api.myTeams();
}

const validMembers = computed(() =>
  members.value.map((m) => (m.trim() === '' ? null : validateName(m))),
);

const filled = computed(() => validMembers.value.filter((v) => v !== null) as { ok: true; name: string }[]);

function rowOpts(i: number): Record<string, unknown> | undefined {
  const opts: Record<string, unknown> = {};
  if (memberGenders.value[i]) opts['gender'] = memberGenders.value[i];
  if (memberJobs.value[i]) opts['jobId'] = memberJobs.value[i];
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

function createError(): string {
  if (filled.value.length === 0) return '至少填 1 名队员';
  if (filled.value.length > maxUnits.value) return `最多 ${maxUnits.value} 人`;
  for (const v of validMembers.value) {
    if (v && !v.ok) return v.reason;
  }
  return '';
}

async function create() {
  const err = createError();
  if (err) {
    error.value = err;
    return;
  }
  error.value = '';
  busy.value = true;
  try {
    const payload = members.value
      .map((name, i) => ({ name: name.trim(), opts: rowOpts(i) }))
      .filter((m) => m.name !== '')
      .map((m) => (m.opts ? { name: m.name, opts: m.opts } : m.name));
    await api.createTeam(activeMod.value, payload);
    members.value = members.value.map(() => '');
    memberGenders.value = memberGenders.value.map(() => '');
    memberJobs.value = memberJobs.value.map(() => '');
    await refresh();
  } catch (e) {
    error.value = (e as Error).message;
  } finally {
    busy.value = false;
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

/** 列表按当前模式的生成域过滤 */
const myModTeams = computed(() => teams.value.filter((x) => x.modId === activeMod.value));
</script>

<template>
  <PageHero
    icon="team"
    title="我的队伍"
    :subtitle="`填 1~${maxUnits || '…'} 名队员；打过一场后自动进入数据池`"
  />

  <PageTabs
    v-model="mobileTab"
    class="mobile-only"
    :tabs="[
      { key: 'create', label: '创建队伍', icon: 'sparkles' },
      { key: 'list', label: '队伍列表', icon: 'team' },
    ]"
  />

  <!-- 上：创建队伍（横向成员卡带） -->
  <div class="panel gold" :class="{ 'mobile-hide': mobileTab !== 'create' }">
    <div class="panel-head">
      <span class="t"><GameIcon name="sparkles" :size="14" />创建队伍</span>
      <span class="acts">
        <span class="tag">{{ filled.length }}/{{ maxUnits }} 人</span>
        <button class="btn small primary" :disabled="busy" @click="create">
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
          <select v-model="memberJobs[i]" class="input">
            <option value="">职业随机</option>
            <option v-for="j in JOBS" :key="j.id" :value="j.id">{{ j.name }}</option>
          </select>
        </template>
      </div>
    </div>
    <div v-if="error" class="error-text" style="margin-top: 6px">{{ error }}</div>
  </div>

  <!-- 下：队伍列表（横向卡片带 + 选中详情） -->
  <div class="panel team-panel" :class="{ 'mobile-hide': mobileTab !== 'list' }">
    <div class="panel-head">
      <span class="t"><GameIcon name="team" :size="14" />队伍列表</span>
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
        这个模式还没有队伍——在上面填几个名字，点「创建队伍」
      </div>
    </div>

    <!-- 选中详情：成员横排，区内垂直滚动 -->
    <div v-if="expanded" class="team-detail">
      <div
        v-for="(name, i) in myModTeams.find((t) => t.id === expanded)?.members ?? []"
        :key="name"
        class="detail-member"
      >
        <CharacterPanel
          v-if="validateName(name).ok"
          :char="previewChar(myModTeams.find((t) => t.id === expanded)!.modId, name, myModTeams.find((t) => t.id === expanded)!.memberOpts?.[i] ?? null)"
          :mod-id="myModTeams.find((t) => t.id === expanded)!.modId"
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 移动端二级页签切换：非当前块隐藏（!important 防 display:flex 覆盖）；
   桌面（≥900px）无此规则，双块自然同显 */
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
</style>
