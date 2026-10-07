<script setup lang="ts">
import { computed } from 'vue';
import { getMod } from '@namearena/core';
import type { Mod } from '@namearena/core';

/**
 * 角色详情面板（模组驱动，ModDisplay 契约）：
 * 头部（名字+副标签）→ 六维（分档配色）→ 战斗属性行 → 技能卡。
 * 取名实验室与队伍展开详情共用；不同模组的角色结构不同，全部经 mod.display 翻译。
 * 注意：Boolean prop 未传时会被 Vue 转成 false，必须用 withDefaults 给 true。
 */
const props = withDefaults(
  defineProps<{ char: unknown; modId: string; showAbilities?: boolean }>(),
  { showAbilities: true },
);

const mod = computed(() => {
  try {
    return getMod(props.modId);
  } catch {
    return null;
  }
});
const display = computed(() => mod.value?.display ?? null);

const tags = computed(() => (display.value ? display.value.tags(props.char) : []));

function tierLabel(id: string): string {
  return display.value?.tierLabel(id) ?? '';
}
</script>

<template>
  <div v-if="display">
    <div class="row" style="justify-content: space-between; margin-bottom: 4px">
      <div class="name-row" style="display: flex; gap: 6px; align-items: baseline">
        <b style="font-size: 15px">{{ (char as { name?: string }).name }}</b>
        <span v-for="t in tags" :key="t" class="tag gold">{{ t }}</span>
      </div>
    </div>

    <div class="row" style="gap: 4px; margin-bottom: 8px">
      <div
        v-for="s in display.sixStats"
        :key="s.key"
        style="text-align: center; flex: 1; min-width: 44px"
        :title="tierLabel((char as { tiers?: Record<string, string> }).tiers?.[s.key] ?? '')"
      >
        <div class="muted" style="font-size: 11px">{{ s.label }}</div>
        <div class="tier-num" :class="`tier-${(char as { tiers?: Record<string, string> }).tiers?.[s.key] ?? 'mid'}`">
          {{ (char as { base?: Record<string, number> }).base?.[s.key] ?? '·' }}
        </div>
      </div>
    </div>

    <div class="pills" style="margin: 0 0 4px">
      <span v-for="d in display.derivedRows(char)" :key="d.label" class="pill">{{ d.label }} <b>{{ d.value }}</b></span>
    </div>

    <div v-if="showAbilities !== false && display.skills(char).length" class="ability-cards">
      <div v-for="a in display.skills(char)" :key="a.id" class="ability-card">
        <div class="head">
          <span class="tag kinds" :class="a.kind === 'active' ? 'gold' : 'passive'">{{ a.kind === 'active' ? '主动' : '被动' }}</span>
          <b>{{ a.name }}</b>
        </div>
        <div class="desc">{{ a.desc }}</div>
      </div>
    </div>
  </div>
</template>
