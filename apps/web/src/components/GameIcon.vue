<script setup lang="ts">
import { computed } from 'vue';
import { ICONS } from '../icons';

/**
 * 全站图标元件（决策 #58）：内联 SVG，填充继承 currentColor，
 * 尺寸由 size prop（px）控制，颜色随所在文字色。
 */
const props = withDefaults(defineProps<{ name: string; size?: number }>(), { size: 16 });

const inner = computed(() => ICONS[props.name] ?? '');
</script>

<template>
  <!-- 图标名不存在时整体不渲染（模组驱动的键可能无对应图标） -->
  <svg
    v-if="inner"
    class="gi"
    :width="size"
    :height="size"
    viewBox="0 0 512 512"
    aria-hidden="true"
    v-html="inner"
  />
</template>

<style scoped>
.gi {
  display: inline-block;
  vertical-align: -0.15em;
  flex: none;
  fill: currentColor;
}
</style>
