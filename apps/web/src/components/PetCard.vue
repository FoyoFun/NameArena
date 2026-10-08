<script setup lang="ts">
import { computed } from 'vue';
import type { UnitViewState } from '../battle-stage/sequencer';
import { sequencer } from '../battle-stage/sequencer';
import { getVfx } from '../battle-stage/vfx';
import GameIcon from './GameIcon.vue';

/**
 * 召唤物小卡（决策 #59）：只显示名字、主人、血量；
 * 挂各自阵营底部横排，受击/治疗照样弹飘字与特效。
 */
const props = defineProps<{ unit: UnitViewState }>();

const hp = computed(() => Math.round(props.unit.stats['hp'] ?? 0));
const maxHp = computed(() => Math.max(1, Math.round(props.unit.stats['maxHp'] ?? 1)));
const pct = computed(() => Math.max(0, Math.min(100, (hp.value / maxHp.value) * 100)));

function hpColor(): string {
  const r = hp.value / maxHp.value;
  return r > 0.55 ? 'var(--hp-hi)' : r > 0.25 ? 'var(--hp-mid)' : 'var(--hp-lo)';
}

const myFloats = computed(() => sequencer.state.floats.filter((f) => f.uid === props.unit.uid));
const vfxCls = computed(() =>
  sequencer.state.vfxes
    .filter((v) => v.target === `unit:${props.unit.uid}`)
    .map((v) => getVfx(v.vfx)?.cls ?? '')
    .filter(Boolean)
    .join(' '),
);
const lastVfx = computed(() =>
  sequencer.state.vfxes.filter((v) => v.target === `unit:${props.unit.uid}`).slice(-1)[0],
);

function vfxEmojiOf(v: { vfx: string; emoji: string }): string {
  return v.emoji || getVfx(v.vfx)?.emoji || '';
}
</script>

<template>
  <div class="pet-card" :class="{ down: unit.down }">
    <span v-if="lastVfx" :key="lastVfx.id" class="vfx-pop">{{ vfxEmojiOf(lastVfx) }}</span>
    <div :class="vfxCls" class="pet-inner">
      <div class="pet-name" :title="unit.owner ? `${unit.owner} 的召唤物` : '召唤物'">
        <GameIcon name="potion" :size="10" />
        <span class="nm3">{{ unit.name }}</span>
        <span v-if="unit.owner" class="owner3">{{ unit.owner }}</span>
      </div>
      <div class="bar pet-bar">
        <div class="fill" :style="{ width: `${pct}%`, backgroundColor: hpColor() }" />
        <span class="bar-label">{{ hp }}/{{ maxHp }}</span>
      </div>
      <div
        v-for="f in myFloats"
        :key="f.id"
        class="float-num"
        :class="f.kind"
        style="font-size: 15px"
      >
        {{ f.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.pet-card {
  position: relative;
  flex: 0 0 auto;
  width: 118px;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  border-radius: var(--radius-sm);
  padding: 5px 7px;
  overflow: hidden;
  animation: petIn var(--dur-2) var(--ease-out-back);
  transition: filter 700ms var(--ease-out);
}

.pet-card.down {
  filter: grayscale(1) brightness(0.55);
}

.pet-inner {
  position: relative;
}

.pet-name {
  display: flex;
  align-items: center;
  gap: 4px;
  color: var(--muted);
  min-width: 0;
}

.pet-name .nm3 {
  font-size: 12px;
  font-weight: 700;
  color: var(--text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pet-name .owner3 {
  font-size: 10px;
  color: var(--faint);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pet-bar {
  height: 10px;
  margin-top: 4px;
}

.pet-bar .bar-label {
  font-size: 9px;
}

@keyframes petIn {
  from { opacity: 0; transform: scale(0.7); }
}
</style>
