<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { generateNormalCharacter, validateName } from '@namearena/core';
import type { Character } from '@namearena/core';
import { api, type ModInfo } from '../api';
import CharacterPanel from '../components/CharacterPanel.vue';

const router = useRouter();
const mods = ref<ModInfo[]>([]);
const activeMod = ref('normal-pvp');
const nameA = ref('张三');
const nameB = ref('李四');
const charA = ref<Character | null>(null);
const charB = ref<Character | null>(null);
const error = ref('');

onMounted(async () => {
  try {
    mods.value = await api.mods();
  } catch {
    /* 服务器不在时仍可用本地生成 */
  }
});

const mod = computed(() => mods.value.find((m) => m.id === activeMod.value));

/** 生成域（DESIGN.md 决策 #26）：同域模组同名同角色；没拿到模组表时用常规域兜底 */
const genKey = computed(() => mod.value?.genKey ?? 'normal');
const genVersion = computed(() => mod.value?.genVersion ?? 2);

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
  charA.value = generateNormalCharacter(va.name, genKey.value, genVersion.value);
  charB.value = generateNormalCharacter(vb.name, genKey.value, genVersion.value);
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
  router.push({
    path: '/battle/local',
    query: { a: a.name, b: b.name, modId: activeMod.value, t: String(Date.now()) },
  });
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
  </div>

  <div class="lab-grid">
    <div v-for="(c, idx) in [charA, charB]" :key="idx" class="panel">
      <CharacterPanel v-if="c" :char="c" />
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
