<script setup lang="ts">
import { computed, ref } from 'vue';
import type { StatMeta } from '@namearena/core';
import { getVfx } from './vfx';
import { sequencer } from './sequencer';
import type { UnitViewState } from './sequencer';

const props = defineProps<{ unit: UnitViewState; statsMeta: StatMeta[]; index: number }>();

const SIX: Array<{ key: string; label: string }> = [
  { key: 'str', label: '力' },
  { key: 'wis', label: '智' },
  { key: 'vit', label: '体' },
  { key: 'spr', label: '神' },
  { key: 'agi', label: '敏' },
  { key: 'luk', label: '运' },
];

/** 六维分档配色走 theme.css 的 .tier-* 全局类（换主题不动本组件） */

const abilitiesOpen = ref(false);

const bars = computed(() => props.statsMeta.filter((s) => s.show === 'bar'));
const pills = computed(() => props.statsMeta.filter((s) => s.show === 'pill'));

function hpColor(u: UnitViewState): string {
  const hp = u.stats['hp'] ?? 0;
  const max = u.stats['maxHp'] ?? 1;
  const r = hp / max;
  return r > 0.55 ? 'var(--hp-hi)' : r > 0.25 ? 'var(--hp-mid)' : 'var(--hp-lo)';
}

function fmt(meta: StatMeta, u: UnitViewState): string {
  const v = u.stats[meta.id] ?? 0;
  if (meta.desc === '百分比' || meta.id === 'dodge' || meta.id === 'crit') {
    return `${Math.round(v * 100)}%`;
  }
  return String(Math.round(v * 10) / 10);
}

const myFloats = computed(() => sequencer.state.floats.filter((f) => f.uid === props.unit.uid));
const myVfx = computed(() => sequencer.state.vfxes.filter((v) => v.target === `unit:${props.unit.uid}`));
const vfxCls = computed(() =>
  myVfx.value
    .map((v) => getVfx(v.vfx)?.cls ?? '')
    .filter(Boolean)
    .join(' '),
);
/** 最近一条特效：emoji 弹出 span 以它的 id 作 key，连续特效每次都会重新弹出 */
const lastVfx = computed(() => myVfx.value[myVfx.value.length - 1]);

function vfxEmojiOf(v: { vfx: string; emoji: string }): string {
  return v.emoji || getVfx(v.vfx)?.emoji || '';
}
</script>

<template>
  <div class="unit-card" :class="[`side-${unit.side}`, { down: unit.down }]">
    <span v-if="lastVfx" :key="lastVfx.id" class="vfx-pop">{{ vfxEmojiOf(lastVfx) }}</span>
    <div :class="vfxCls" style="height: 100%">
      <div class="name-row">
        <span class="name">{{ unit.name }}</span>
        <span class="pfill">{{ unit.personalityName }}</span>
        <span class="owner" v-if="unit.owner">{{ unit.owner }}</span>
        <span v-if="unit.totalCost > 0" class="tag" :title="'能力总 cost（伪预算）'">cost {{ unit.totalCost }}</span>
      </div>

      <!-- 六维（分档配色，默认显示） -->
      <div class="six-row">
        <span v-for="s in SIX" :key="s.key" class="six-item" :title="unit.base[s.key] !== undefined ? `${s.label} ${unit.base[s.key]}` : s.label">
          <i class="muted">{{ s.label }}</i>
          <b :class="`tier-${unit.tiers[s.key] ?? 'mid'}`">{{ unit.base[s.key] ?? '·' }}</b>
        </span>
      </div>

      <div v-for="meta in bars" :key="meta.id">
        <div class="bar">
          <div
            class="fill"
            :style="{
              width: `${Math.max(0, Math.min(100, ((unit.stats[meta.id] ?? 0) / (unit.stats[meta.barMaxStat ?? 'maxHp'] ?? 1)) * 100))}%`,
              backgroundColor: meta.id === 'hp' ? hpColor(unit) : 'var(--mp)',
            }"
          />
          <span class="bar-label">{{ meta.label }} {{ unit.stats[meta.id] ?? 0 }}/{{ unit.stats[meta.barMaxStat ?? 'maxHp'] ?? 0 }}</span>
        </div>
      </div>

      <div class="pills">
        <span v-for="meta in pills" :key="meta.id" class="pill" :title="meta.label">
          {{ meta.label }} <b>{{ fmt(meta, unit) }}</b>
        </span>
      </div>

      <div class="status-row">
        <span v-for="s in unit.statuses" :key="s.id" class="status-ico" :class="s.kind" :title="s.name">
          {{ s.kind === 'buff' ? '⬆' : '⬇' }}{{ s.name }}
        </span>
      </div>

      <!-- 能力：默认折叠，点击展开（能力以卡片展示） -->
      <div class="ab-toggle" @click="abilitiesOpen = !abilitiesOpen">
        {{ abilitiesOpen ? '▾' : '▸' }} 能力 {{ unit.abilities.length }}
      </div>
      <div v-if="abilitiesOpen" class="ability-cards" style="grid-template-columns: 1fr">
        <div v-for="a in unit.abilities" :key="a.id" class="ability-card mini" :title="a.desc">
          <div class="head">
            <span class="tag kinds" :class="a.kind === 'active' ? 'gold' : 'passive'">{{ a.kind === 'active' ? '主动' : '被动' }}</span>
            <b>{{ a.name }}</b>
          </div>
          <div class="desc">{{ a.desc }}</div>
        </div>
      </div>

      <div
        v-for="f in myFloats"
        :key="f.id"
        class="float-num"
        :class="f.kind"
        :style="{ top: `${28 + (f.id % 3) * 9}%` }"
      >
        {{ f.text }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.six-row {
  display: flex;
  gap: 4px;
  margin-top: 5px;
}

.six-item {
  flex: 1;
  text-align: center;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1px 0;
  line-height: 1.3;
}

.six-item i {
  font-style: normal;
  font-size: 10px;
  display: block;
}

.six-item b {
  font-size: 13px;
}

.ab-toggle {
  margin-top: 5px;
  font-size: 12px;
  color: var(--muted);
  cursor: pointer;
  user-select: none;
}

.ab-toggle:hover {
  color: var(--text);
}

.ab-list {
  margin-top: 4px;
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.ab-item {
  font-size: 12px;
  background: var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 6px;
  padding: 1px 6px;
}
</style>
