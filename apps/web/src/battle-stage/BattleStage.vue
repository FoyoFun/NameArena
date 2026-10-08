<script setup lang="ts">
import { computed } from 'vue';
import type { ModDisplay, StatMeta } from '@namearena/core';
import { sequencer } from './sequencer';
import UnitCard from './UnitCard.vue';
import PetCard from '../components/PetCard.vue';

const props = defineProps<{ statsMeta: StatMeta[]; display: ModDisplay }>();

/** 召唤物（pet）不进主卡区：归入各阵营底部的召唤物条（决策 #59） */
const sideA = computed(() => sequencer.state.units.filter((u) => u.side === 'A' && !u.pet));
const sideB = computed(() => sequencer.state.units.filter((u) => u.side === 'B' && !u.pet));
const petsA = computed(() => sequencer.state.units.filter((u) => u.side === 'A' && u.pet));
const petsB = computed(() => sequencer.state.units.filter((u) => u.side === 'B' && u.pet));

const stageVfx = computed(() => sequencer.state.vfxes.filter((v) => v.target === 'stage').length > 0);

/** 播放代次：key 掺入它，重播同一场时单位卡也会重建 → 开场入场动画每次都触发 */
const gen = computed(() => sequencer.state.gen);
</script>

<template>
  <div class="stage" :class="{ 'vfx-stage': stageVfx }">
    <div class="side-block side-A">
      <div class="units-scroll">
        <UnitCard v-for="(u, i) in sideA" :key="`${u.uid}-${gen}`" :unit="u" :stats-meta="props.statsMeta" :display="props.display" :index="i" />
      </div>
      <div v-if="petsA.length" class="pet-strip">
        <PetCard v-for="p in petsA" :key="`${p.uid}-${gen}`" :unit="p" />
      </div>
    </div>
    <div class="side-block side-B">
      <div class="units-scroll">
        <UnitCard v-for="(u, i) in sideB" :key="`${u.uid}-${gen}`" :unit="u" :stats-meta="props.statsMeta" :display="props.display" :index="i" />
      </div>
      <div v-if="petsB.length" class="pet-strip">
        <PetCard v-for="p in petsB" :key="`${p.uid}-${gen}`" :unit="p" />
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 主卡区：空间不足时在各自阵营内滚动（战报保底 40%，决策 #59）。
   min-width:0 必须写——flex 子项默认 min-width:auto，召唤物条一多会把整个
   阵营块撑宽，舞台布局整体崩坏（主人实测 bug）。
   卡片 flex:none——unit-card 是 overflow:hidden，flex 的最小高度保护对它失效
   （min-height:auto 解析为 0），默认 flex-shrink 会把展开技能的卡片压扁裁掉。
   阵营文字标签（🔴 A 方/🔵 B 方/VS）已删（决策 #62）：阵营只靠卡片顶部色条区分。 */
.units-scroll {
  display: flex;
  flex-direction: column;
  gap: var(--sp-2);
  min-height: 0;
  min-width: 0;
}

.units-scroll > .unit-card {
  flex: none;
}

.side-block {
  min-width: 0;
}

/* 召唤物条：横排小卡，超出水平滚动 */
.pet-strip {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  overflow-y: hidden;
  padding: 2px;
  flex: none;
  min-width: 0;
}

/* 移动端：舞台吃满 battle-top，主卡区改横排小卡（水平拖拽），战报固定底部 40%。
   敌方（B 方）在上：scoped 的 .side-B 会同时命中子组件根元素（unit-card 也带
   父 scope id），必须写全 .side-block.side-B 限定。 */
@media (max-width: 899px) {
  .stage {
    flex: 1;
    min-height: 0;
    flex-direction: column;
    gap: 8px;
  }

  .side-block {
    min-height: 0;
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }

  .units-scroll {
    flex: 1;
    flex-direction: row;
    overflow-y: hidden;
    overflow-x: auto;
    overscroll-behavior: contain;
    align-items: flex-start; /* 卡片按内容自然高，不随容器拉伸 */
    padding-bottom: 4px;
  }

  .units-scroll > .unit-card {
    flex: 0 0 auto;
    width: 168px;
  }

  .side-block.side-B {
    order: -1;
  }
}

/* 桌面：两列对峙（左右），各自内滚 */
@media (min-width: 900px) {
  .stage {
    flex: 1;
    min-height: 0;
    flex-direction: row;
    align-items: stretch;
  }

  .side-block {
    min-height: 0;
    flex: 1;
  }

  .units-scroll {
    flex: 1;
    overflow-y: auto;
    overscroll-behavior: contain;
    padding-right: 2px;
  }
}
</style>
