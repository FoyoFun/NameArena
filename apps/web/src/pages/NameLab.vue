<script setup lang="ts">
import { computed, reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { fantasySeed, getMod, makeRng, nameSeed, validateName } from '@namearena/core';
import CharacterPanel from '../components/CharacterPanel.vue';
import GameIcon from '../components/GameIcon.vue';
import PageHero from '../components/PageHero.vue';
import { useMode } from '../mode';

const router = useRouter();
const { activeMode } = useMode();

const nameA = ref('张三');
const nameB = ref('李四');
const charA = ref<unknown | null>(null);
const charB = ref<unknown | null>(null);
const error = ref('');

/** 性别选择（'' = 随机）。F52：职业改为种子随机，不再可选 */
const selA = reactive({ gender: '' });
const selB = reactive({ gender: '' });

const activeMod = computed(() => activeMode.value?.id ?? 'fantasy-pvp');
const isFantasy = computed(() => activeMod.value.startsWith('fantasy'));

function optsOf(sel: { gender: string }): Record<string, unknown> | undefined {
  return sel.gender ? { gender: sel.gender } : undefined;
}

/** 按当前模组生成角色（同名同选同域同版本必同角色）。
 *  生成器走 core 的 getMod——客户端与服务器同一份模组代码。 */
function generateFor(name: string, sel: { gender: string }): unknown {
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
    if (selB.gender) query['gb'] = selB.gender;
  }
  router.push({ path: '/battle/local', query });
}
</script>

<template>
  <PageHero icon="lab" title="1vs1" subtitle="名字决定一切——同名永远同角色；半角英文数字，大小写敏感，最长 16 字符" />

  <!-- 左右对决：A 卡 | 按钮列 | B 卡；生成结果直接长在输入卡下面 -->
  <div class="duel">
    <div class="panel danger duel-side">
      <div class="panel-head">
        <span class="t"><GameIcon name="user" :size="14" />对阵 A</span>
      </div>
      <input v-model="nameA" class="input name-input" placeholder="名字 A…" maxlength="40" @input="charA = null" />
      <select v-model="selA.gender" class="input">
        <option value="">性别随机</option>
        <option value="male">♂ 男</option>
        <option value="female">♀ 女</option>
      </select>
      <div class="duel-result">
        <CharacterPanel v-if="charA" :char="charA" :mod-id="activeMod" />
        <div v-else class="muted empty" style="padding: 30px 0">
          点击中间「生成角色」<br />
          <span style="font-size: 12px">说不定就出了个传奇</span>
        </div>
      </div>
    </div>

    <div class="duel-mid">
      <div class="vs-mark">VS</div>
      <button class="btn" title="两边同时随机" @click="randomBoth"><GameIcon name="dice" :size="14" />随机</button>
      <button class="btn primary" @click="generate"><GameIcon name="sparkles" :size="14" />生成角色</button>
      <button class="btn" @click="quickBattle"><GameIcon name="swords" :size="14" />快斗一场</button>
      <div v-if="error" class="error-text duel-err">{{ error }}</div>
    </div>

    <div class="panel info duel-side">
      <div class="panel-head">
        <span class="t"><GameIcon name="user" :size="14" />对阵 B</span>
      </div>
      <input v-model="nameB" class="input name-input" placeholder="名字 B…" maxlength="40" @input="charB = null" />
      <select v-model="selB.gender" class="input">
        <option value="">性别随机</option>
        <option value="male">♂ 男</option>
        <option value="female">♀ 女</option>
      </select>
      <div class="duel-result">
        <CharacterPanel v-if="charB" :char="charB" :mod-id="activeMod" />
        <div v-else class="muted empty" style="padding: 30px 0">
          右边也来一个<br />
          <span style="font-size: 12px">输了不许改名字</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.duel {
  display: grid;
  grid-template-columns: 1fr minmax(130px, 160px) 1fr;
  gap: var(--sp-3);
  align-items: stretch;
}

.duel-side {
  display: flex;
  flex-direction: column;
  margin-bottom: 0;
}

.name-input {
  margin-bottom: 6px;
}

.pick-row {
  display: flex;
  gap: 6px;
}

.pick-row .input {
  flex: 1;
  min-width: 0;
}

.duel-result {
  flex: 1;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--border-soft);
}

.duel-mid {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 8px;
}

.vs-mark {
  text-align: center;
  font-size: 22px;
  font-weight: 800;
  letter-spacing: 0.1em;
  color: var(--faint);
  margin-bottom: 4px;
}

.duel-err {
  text-align: center;
}

/* 窄屏退化为竖排：A、按钮、B 依次向下 */
@media (max-width: 899px) {
  .duel {
    grid-template-columns: 1fr;
  }

  .duel-mid {
    flex-direction: row;
    flex-wrap: wrap;
    justify-content: center;
  }

  .vs-mark {
    width: 100%;
    margin-bottom: 0;
  }

  .duel-mid .btn {
    flex: 1;
    min-width: 100px;
  }
}
</style>
