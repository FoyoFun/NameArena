<script setup lang="ts">
import { computed } from 'vue';
import type { StatMeta } from '@namearena/core';
import { sequencer } from './sequencer';
import UnitCard from './UnitCard.vue';

const props = defineProps<{ statsMeta: StatMeta[] }>();

const sideA = computed(() => sequencer.state.units.filter((u) => u.side === 'A'));
const sideB = computed(() => sequencer.state.units.filter((u) => u.side === 'B'));

const stageVfx = computed(() => sequencer.state.vfxes.filter((v) => v.target === 'stage').length > 0);

/** 播放代次：key 掺入它，重播同一场时单位卡也会重建 → 开场入场动画每次都触发 */
const gen = computed(() => sequencer.state.gen);
</script>

<template>
  <div class="stage" :class="{ 'vfx-stage': stageVfx }">
    <div class="side-block side-A">
      <div class="side-label">🔴 A 方</div>
      <UnitCard v-for="(u, i) in sideA" :key="`${u.uid}-${gen}`" :unit="u" :stats-meta="props.statsMeta" :index="i" />
    </div>
    <div class="vs-divider">VS</div>
    <div class="side-block side-B">
      <div class="side-label">🔵 B 方</div>
      <UnitCard v-for="(u, i) in sideB" :key="`${u.uid}-${gen}`" :unit="u" :stats-meta="props.statsMeta" :index="i" />
    </div>
  </div>
</template>

<style scoped>
/* 手机竖屏优先：敌方（B 方）在上，我方（A 方）在下 */
@media (max-width: 899px) {
  .side-B {
    order: -1;
  }
}
</style>
