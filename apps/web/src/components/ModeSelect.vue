<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { useMode } from '../mode';
import GameIcon from './GameIcon.vue';

/**
 * 模式显示与切换（决策 #59）：侧栏顶部 / 移动端顶栏共用。
 * 点击展开全部模式，选择后切换全局模式（页签与各页生成域随之变化）。
 */
const { modes, activeMode, activeModeId } = useMode();

const open = ref(false);
const rootEl = ref<HTMLElement | null>(null);

function toggle(): void {
  open.value = !open.value;
}

function pick(id: string): void {
  activeModeId.value = id;
  open.value = false;
}

function onDocClick(e: MouseEvent): void {
  if (!open.value) return;
  if (rootEl.value && !rootEl.value.contains(e.target as Node)) open.value = false;
}

onMounted(() => document.addEventListener('click', onDocClick));
onBeforeUnmount(() => document.removeEventListener('click', onDocClick));
</script>

<template>
  <div ref="rootEl" class="mode-select">
    <button class="mode-btn" type="button" @click.stop="toggle">
      <GameIcon :name="activeMode?.icon ?? 'swords'" :size="14" />
      <span class="mode-name">{{ activeMode?.name ?? '选择模式' }}</span>
      <i class="caret" :class="{ up: open }" />
    </button>
    <transition name="mode-pop">
      <div v-if="open" class="mode-menu">
        <button
          v-for="m in modes"
          :key="m.id"
          type="button"
          class="mode-item"
          :class="{ on: m.id === activeModeId }"
          @click="pick(m.id)"
        >
          <GameIcon :name="m.icon" :size="14" />
          <span>{{ m.name }}</span>
          <GameIcon v-if="m.id === activeModeId" name="check" :size="12" class="on-ico" />
        </button>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.mode-select {
  position: relative;
}

.mode-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  border: 1px solid rgba(243, 183, 96, 0.35);
  background: rgba(243, 183, 96, 0.1);
  color: var(--accent);
  border-radius: var(--radius-sm);
  padding: 7px 9px;
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
  transition: background-color var(--dur-1) var(--ease-out), border-color var(--dur-1) var(--ease-out);
}

.mode-btn:hover {
  background: rgba(243, 183, 96, 0.16);
  border-color: rgba(243, 183, 96, 0.55);
}

.mode-name {
  flex: 1;
  text-align: left;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.caret {
  width: 7px;
  height: 7px;
  flex: none;
  border-right: 2px solid currentColor;
  border-bottom: 2px solid currentColor;
  transform: rotate(45deg) translateY(-2px);
  transition: transform var(--dur-1) var(--ease-out);
}

.caret.up {
  transform: rotate(-135deg) translateY(-2px);
}

.mode-menu {
  position: absolute;
  top: calc(100% + 4px);
  left: 0;
  right: 0;
  z-index: 50;
  background: var(--panel);
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-sm);
  padding: 4px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.45);
}

.mode-item {
  display: flex;
  align-items: center;
  gap: 8px;
  border: none;
  background: transparent;
  color: var(--muted);
  border-radius: var(--radius-sm);
  padding: 7px 9px;
  font-size: 13px;
  cursor: pointer;
  text-align: left;
  transition: background-color var(--dur-1) var(--ease-out), color var(--dur-1) var(--ease-out);
}

.mode-item:hover {
  background: rgba(255, 255, 255, 0.06);
  color: var(--text);
}

.mode-item.on {
  color: var(--accent);
  background: rgba(243, 183, 96, 0.1);
}

.mode-item .on-ico {
  margin-left: auto;
}

.mode-pop-enter-active {
  transition: opacity var(--dur-1) var(--ease-out), transform var(--dur-1) var(--ease-out);
}

.mode-pop-enter-from {
  opacity: 0;
  transform: translateY(-4px);
}
</style>
