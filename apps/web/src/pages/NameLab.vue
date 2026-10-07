<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { fantasySeed, getMod, JOBS, makeRng, nameSeed, validateName } from '@namearena/core';
import { api, type ModInfo } from '../api';
import CharacterPanel from '../components/CharacterPanel.vue';

const router = useRouter();
const mods = ref<ModInfo[]>([]);
const activeMod = ref('fantasy-pvp');
const nameA = ref('张三');
const nameB = ref('李四');
const charA = ref<unknown | null>(null);
const charB = ref<unknown | null>(null);
const error = ref('');

/** 性别/职业选择（主人裁定 F42：可选、参与种子、无属性偏置；'' = 随机） */
const selA = reactive({ gender: '', jobId: '' });
const selB = reactive({ gender: '', jobId: '' });

onMounted(async () => {
  try {
    mods.value = await api.mods();
  } catch {
    /* 服务器不在时仍可用本地生成 */
  }
});

const mod = computed(() => mods.value.find((m) => m.id === activeMod.value));
const isFantasy = computed(() => activeMod.value.startsWith('fantasy'));

function optsOf(sel: { gender: string; jobId: string }): Record<string, unknown> | undefined {
  const opts: Record<string, unknown> = {};
  if (sel.gender) opts['gender'] = sel.gender;
  if (sel.jobId) opts['jobId'] = sel.jobId;
  return Object.keys(opts).length ? opts : undefined;
}

/** 按当前模组生成角色（同名同选同域同版本必同角色）。
 *  生成器走 core 的 getMod——客户端与服务器同一份模组代码。 */
function generateFor(name: string, sel: { gender: string; jobId: string }): unknown {
  const m = getMod(activeMod.value);
  const opts = optsOf(sel);
  // fantasy 的选择参与种子（fantasySeed）；其他模组无选项概念
  const seed = isFantasy.value
    ? fantasySeed(name, m.genKey, m.genVersion, opts as Parameters<typeof fantasySeed>[3])
    : nameSeed(name, m.genKey, m.genVersion);
  return m.generateCharacter(makeRng(seed), { name, opts });
}

/** 主人要求：输入后点击按钮才生成，带一点开盲盒的仪式感（DESIGN.md #42） */
function generate() {
  error.value = '';
  const va = validateName(nameA.value);
  const vb = validateName(nameB.value);
  if (!va.ok) {
    error.value = `名字 A：${va.reason}`;
    return;
  }
  if (!vb.ok) {
    error.value = `名字 B：${vb.reason}`;
    return;
  }
  charA.value = generateFor(va.name, selA);
  charB.value = generateFor(vb.name, selB);
}

const RANDOM_POOL = [
  '赵日天', '王富贵', '李云龙', '龙傲天', '赵铁柱', '欧阳锋', '亚历山大', '小明', '灭霸',
  '张全蛋', '诺克萨斯', '李逍遥', '赵灵儿', '史强', '周处', '哪吒', '敖丙', '申公豹', '结衣', '阿强',
];

function randomName(): string {
  return RANDOM_POOL[Math.floor(Math.random() * RANDOM_POOL.length)]!;
}

function randomBoth(): void {
  nameA.value = randomName();
  nameB.value = randomName();
  charA.value = null;
  charB.value = null;
  error.value = '';
}

function quickBattle(): void {
  const a = validateName(nameA.value);
  const b = validateName(nameB.value);
  if (!a.ok) {
    error.value = a.reason;
    return;
  }
  if (!b.ok) {
    error.value = `对手名：${b.reason}`;
    return;
  }
  error.value = '';
  const query: Record<string, string> = { a: a.name, b: b.name, modId: activeMod.value, t: String(Date.now()) };
  if (isFantasy.value) {
    if (selA.gender) query['ga'] = selA.gender;
    if (selA.jobId) query['ja'] = selA.jobId;
    if (selB.gender) query['gb'] = selB.gender;
    if (selB.jobId) query['jb'] = selB.jobId;
  }
  router.push({ path: '/battle/local', query });
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">🧪 取名实验室</div>
    <div class="row" style="margin-bottom: 8px">
      <button
        v-for="m in mods"
        :key="m.id"
        class="btn small"
        :class="{ primary: m.id === activeMod }"
        @click="activeMod = m.id"
      >
        {{ m.name }}
      </button>
    </div>
    <div class="muted" style="margin-bottom: 8px">
      名字决定一切：同名永远同角色。英文数字只允许半角，大小写敏感，最长 16 字符。
    </div>
    <div class="row">
      <input v-model="nameA" class="input" style="flex: 2; min-width: 140px" placeholder="名字 A…" maxlength="40" @input="charA = null" />
      <span class="muted">vs</span>
      <input v-model="nameB" class="input" style="flex: 2; min-width: 140px" placeholder="名字 B…" maxlength="40" @input="charB = null" />
      <button class="btn" @click="randomBoth" title="两边同时随机">🎲 随机</button>
      <button class="btn primary" @click="generate">✨ 生成角色</button>
      <button class="btn" @click="quickBattle">快斗一场</button>
    </div>
    <div v-if="error" class="error-text" style="margin-top: 6px">{{ error }}</div>
    <template v-if="isFantasy">
      <div class="row" style="margin-top: 8px; flex-wrap: wrap">
        <span class="muted" style="min-width: 48px">A 选</span>
        <select v-model="selA.gender" class="input" style="width: 90px">
          <option value="">性别随机</option>
          <option value="male">♂男</option>
          <option value="female">♀女</option>
        </select>
        <select v-model="selA.jobId" class="input" style="width: 120px">
          <option value="">职业随机</option>
          <option v-for="j in JOBS" :key="j.id" :value="j.id">{{ j.name }}</option>
        </select>
        <span class="muted" style="margin-left: auto">选择参与随机、不偏置属性</span>
      </div>
      <div class="row" style="margin-top: 6px; flex-wrap: wrap">
        <span class="muted" style="min-width: 48px">B 选</span>
        <select v-model="selB.gender" class="input" style="width: 90px">
          <option value="">性别随机</option>
          <option value="male">♂男</option>
          <option value="female">♀女</option>
        </select>
        <select v-model="selB.jobId" class="input" style="width: 120px">
          <option value="">职业随机</option>
          <option v-for="j in JOBS" :key="j.id" :value="j.id">{{ j.name }}</option>
        </select>
      </div>
    </template>
  </div>

  <div class="lab-grid">
    <div v-for="(c, idx) in [charA, charB]" :key="idx" class="panel">
      <CharacterPanel v-if="c" :char="c" :mod-id="activeMod" />
      <div v-else class="muted empty" style="padding: 50px 0">
        {{ idx === 0 ? '输入名字，点击「✨ 生成角色」' : '右边也来一个' }}<br />
        <span style="font-size: 12px">说不定就出了个传奇</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.lab-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

@media (min-width: 720px) {
  .lab-grid {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
