<script setup lang="ts">
import GameIcon from './GameIcon.vue';

/**
 * 二级页签条（决策 #61，参考银河奶牛放置）：横排 pill 按钮，激活金色高亮，
 * 超宽横向滚动。用于页面内的功能切换（队伍：创建/列表；竞技：互斗/挑战…）。
 */
defineProps<{ tabs: { key: string; label: string; icon?: string }[] }>();
const model = defineModel<string>({ required: true });
</script>

<template>
  <div class="ptabs">
    <button
      v-for="t in tabs"
      :key="t.key"
      type="button"
      class="ptab"
      :class="{ on: model === t.key }"
      @click="model = t.key"
    >
      <GameIcon v-if="t.icon" :name="t.icon" :size="12" />
      {{ t.label }}
    </button>
  </div>
</template>

<style scoped>
.ptabs {
  display: flex;
  gap: 4px;
  margin-bottom: var(--sp-3);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
}

.ptabs::-webkit-scrollbar {
  display: none;
}

.ptab {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid var(--border-strong);
  background: var(--panel-2);
  color: var(--muted);
  border-radius: var(--radius-sm);
  padding: 4px 12px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  min-height: 28px;
  transition:
    background-color var(--dur-1) var(--ease-out),
    color var(--dur-1) var(--ease-out),
    border-color var(--dur-1) var(--ease-out);
}

.ptab:hover {
  color: var(--text);
}

.ptab.on {
  background: rgba(243, 183, 96, 0.14);
  border-color: rgba(243, 183, 96, 0.45);
  color: var(--accent);
}
</style>
