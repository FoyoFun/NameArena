<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { sequencer } from './sequencer';
import type { LogEntry, UnitViewState } from './sequencer';

/**
 * 战报渲染（主人配色规范）：
 * - A 方行动/承受到的靠左，B 方靠右，回合等居中灰显
 * - 名字徽章：A 方深底白粗、B 方浅底黑粗
 * - +增益+ 绿色、~减益~ 红色、#属性词# 黄色
 * - 贴底滚动：仅当视口本就在底部时才自动跟随，往上翻了就不打扰。
 *   用 MutationObserver + 双 rAF 保证在新行完成布局之后滚动（watch 的异步时序在
 *   批量插入时会停在中间位置，见 DESIGN.md #38）。
 */

interface Segment {
  k: 'name' | 'pos' | 'neg' | 'kw' | 'txt';
  /** name 段存 uid（渲染时查当前场次的名字与阵营），其余存文本 */
  text: string;
}

const KEYWORDS =
  /(生命|法力|攻击|魔攻|物防|魔防|速度|防御|命中|闪避|暴击|暴伤|抵抗|吸收|天选|异常|易伤|行动|伤害|治疗|护盾|眩晕|中毒|灼烧|冰冻|昏厥|流血|再生|回春|咏唱|召唤|复活|重生|连击)/g;
const IS_KEYWORD = /^(生命|法力|攻击|魔攻|物防|魔防|速度|防御|命中|闪避|暴击|暴伤|抵抗|吸收|天选|异常|易伤|行动|伤害|治疗|护盾|眩晕|中毒|灼烧|冰冻|昏厥|流血|再生|回春|咏唱|召唤|复活|重生|连击)$/;

const TOKEN = /@([^@]+)@|\+([^+]+)\+|~([^~]+)~|#([^#]+)#/g;

/** 解析为段：名字段只存 uid——名字/阵营在渲染时按当前场次查询，
 *  否则跨场次缓存会让上一场的人名串进新战斗（DESIGN.md #46） */
function parseText(text: string): Segment[] {
  const segs: Segment[] = [];
  const pushPlain = (t: string) => {
    if (!t) return;
    for (const part of t.split(KEYWORDS)) {
      if (!part) continue;
      segs.push(IS_KEYWORD.test(part) ? { k: 'kw', text: part } : { k: 'txt', text: part });
    }
  };
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const idx = m.index ?? 0;
    if (idx > last) pushPlain(text.slice(last, idx));
    if (m[1] !== undefined) {
      segs.push({ k: 'name', text: m[1] });
    } else if (m[2] !== undefined) {
      segs.push({ k: 'pos', text: m[2] });
    } else if (m[3] !== undefined) {
      segs.push({ k: 'neg', text: m[3] });
    } else {
      segs.push({ k: 'kw', text: m[4] ?? '' });
    }
    last = idx + m[0].length;
  }
  pushPlain(text.slice(last));
  return segs;
}

const cache = new Map<string, Segment[]>();

function segsOf(line: LogEntry): Segment[] {
  const hit = cache.get(line.text);
  if (hit) return hit;
  const segs = parseText(line.text);
  if (cache.size > 2000) cache.clear();
  cache.set(line.text, segs);
  return segs;
}

function unitOf(uid: string): UnitViewState | undefined {
  return sequencer.state.units.find((u) => u.uid === uid);
}

const lines = computed(() => sequencer.state.log);

const logEl = ref<HTMLElement | null>(null);
/** 视口是否贴着底部（用户上翻即暂停自动跟随） */
let stick = true;

function onScroll(): void {
  const el = logEl.value;
  if (!el) return;
  stick = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
}

let mo: MutationObserver | null = null;

onMounted(() => {
  const el = logEl.value;
  if (!el) return;
  mo = new MutationObserver(() => {
    if (!stick) return;
    // 直接同步滚动：MutationObserver 回调里读 scrollHeight 会强制同步布局，值准确。
    // 不用 rAF——浏览器窗格不可见时 rAF 会被暂停，战报就永远滚不到底了。
    el.scrollTop = el.scrollHeight;
  });
  mo.observe(el, { childList: true });
});

onBeforeUnmount(() => {
  mo?.disconnect();
});

defineExpose({ lines });
</script>

<template>
  <div ref="logEl" class="battle-log" @scroll="onScroll">
    <div
      v-for="l in lines"
      :key="l.id"
      class="line"
      :class="{ dim: l.dim, al: l.side === 'A', ar: l.side === 'B' }"
    >
      <template v-for="(s, i) in segsOf(l)" :key="i">
        <span v-if="s.k === 'name'" class="nm" :class="unitOf(s.text)?.side === 'A' ? 'nm-a' : unitOf(s.text)?.side === 'B' ? 'nm-b' : ''">{{ unitOf(s.text)?.name ?? s.text }}</span>
        <span v-else-if="s.k === 'pos'" class="v-pos">{{ s.text }}</span>
        <span v-else-if="s.k === 'neg'" class="v-neg">{{ s.text }}</span>
        <span v-else-if="s.k === 'kw'" class="kw">{{ s.text }}</span>
        <template v-else>{{ s.text }}</template>
      </template>
    </div>
  </div>
</template>
