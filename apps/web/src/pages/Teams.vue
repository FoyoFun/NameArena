<script setup lang="ts">
import { computed, onActivated, onMounted, ref } from 'vue';
import { api, type ModInfo, type TeamInfo } from '../api';
import { fantasySeed, getMod, JOBS, makeRng, nameSeed, validateName } from '@namearena/core';
import CharacterPanel from '../components/CharacterPanel.vue';

const mods = ref<ModInfo[]>([]);
const activeMod = ref<string>('');
const teams = ref<TeamInfo[]>([]);
const members = ref<string[]>([]);
/** 每行的生成选项（fantasy 用；'' = 随机） */
const memberGenders = ref<string[]>([]);
const memberJobs = ref<string[]>([]);
const error = ref('');
const busy = ref(false);
const expanded = ref<string>('');

const mod = computed(() => mods.value.find((m) => m.id === activeMod.value));
const isFantasy = computed(() => activeMod.value.startsWith('fantasy'));

onMounted(async () => {
  mods.value = await api.mods();
  activeMod.value = mods.value[0]?.id ?? '';
  members.value = Array.from({ length: mods.value[0]?.maxUnits ?? 3 }, () => '');
  memberGenders.value = Array.from({ length: mods.value[0]?.maxUnits ?? 3 }, () => '');
  memberJobs.value = Array.from({ length: mods.value[0]?.maxUnits ?? 3 }, () => '');
  await refresh();
});

// keep-alive：切页回来刷新列表数据，但保留输入框等界面状态
onActivated(async () => {
  if (mods.value.length) await refresh();
});

async function refresh() {
  teams.value = await api.myTeams();
}

function switchMod(id: string) {
  activeMod.value = id;
  const m = mods.value.find((x) => x.id === id);
  members.value = Array.from({ length: m?.maxUnits ?? 3 }, (_, i) => members.value[i] ?? '');
  memberGenders.value = Array.from({ length: m?.maxUnits ?? 3 }, () => '');
  memberJobs.value = Array.from({ length: m?.maxUnits ?? 3 }, () => '');
  expanded.value = '';
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
  if (filled.value.length > (mod.value?.maxUnits ?? 3)) return `最多 ${mod.value?.maxUnits} 人`;
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

const myModTeams = computed(() => teams.value.filter((x) => x.modId === activeMod.value));
</script>

<template>
  <div class="panel">
    <div class="panel-title">🛡️ 我的队伍</div>
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

    <div class="muted" style="margin-bottom: 6px">
      填 1~{{ mod?.maxUnits }} 名队员（允许重名、允许多打少）。队伍打过一场后会进入数据池。
    </div>
    <div v-for="(m, i) in members" :key="i" style="margin-bottom: 6px">
      <div class="row">
        <input v-model="members[i]" class="input" style="flex: 1" :placeholder="`队员 ${i + 1}（可留空）`" maxlength="40" />
        <span v-if="m.trim() && !validateName(m).ok" class="error-text" style="white-space: nowrap">名字不合法</span>
      </div>
      <div v-if="isFantasy && m.trim()" class="row" style="margin-top: 4px">
        <select v-model="memberGenders[i]" class="input" style="width: 96px">
          <option value="">性别随机</option>
          <option value="male">♂男</option>
          <option value="female">♀女</option>
        </select>
        <select v-model="memberJobs[i]" class="input" style="width: 120px">
          <option value="">职业随机</option>
          <option v-for="j in JOBS" :key="j.id" :value="j.id">{{ j.name }}</option>
        </select>
        <span class="muted" style="font-size: 12px">选择参与随机、不偏置属性</span>
      </div>
    </div>
    <div v-if="error" class="error-text" style="margin: 6px 0">{{ error }}</div>
    <button class="btn primary" :disabled="busy" @click="create">创建队伍</button>
  </div>

  <div v-for="t in myModTeams" :key="t.id" class="panel" style="cursor: pointer" @click="toggleExpand(t.id)">
    <div class="row" style="justify-content: space-between">
      <div>
        <b>{{ t.members.join(' · ') }}</b>
        <span class="tag" style="margin-left: 6px">{{ t.wins }}胜 {{ t.losses }}负</span>
        <span v-if="t.inPool" class="tag">已入池</span>
      </div>
      <div class="row">
        <button class="btn small" @click.stop="toggleExpand(t.id)">{{ expanded === t.id ? '收起 ▾' : '详情 ▸' }}</button>
        <button class="btn small danger" @click.stop="remove(t.id)">解散</button>
      </div>
    </div>

    <div v-if="expanded === t.id" style="margin-top: 10px; display: grid; gap: 10px" @click.stop>
      <div
        v-for="(name, i) in t.members"
        :key="name"
        style="background: var(--bg-2); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 8px"
      >
        <CharacterPanel
          v-if="validateName(name).ok"
          :char="previewChar(t.modId, name, t.memberOpts?.[i] ?? null)"
          :mod-id="t.modId"
        />
      </div>
    </div>
  </div>
  <div v-if="myModTeams.length === 0" class="muted empty">
    这个模组下还没有队伍，先建一支吧
  </div>
</template>
