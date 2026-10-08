<script setup lang="ts">
import GameIcon from './GameIcon.vue';

/**
 * 页面页头横条（Melvor 题头条的克制版，决策 #58）：
 * 图标方块 + 标题 + 副题 + 右侧动作区（slot）。
 * 每个页面顶部固定放一个，保证「一页看全」的入口感一致。
 */
defineProps<{ icon: string; title: string; subtitle?: string }>();
</script>

<template>
  <div class="page-hero">
    <div class="hero-ico"><GameIcon :name="icon" :size="20" /></div>
    <div class="hero-body">
      <div class="hero-t">{{ title }}</div>
      <div v-if="subtitle" class="hero-s">{{ subtitle }}</div>
    </div>
    <div class="hero-acts"><slot /></div>
  </div>
</template>
