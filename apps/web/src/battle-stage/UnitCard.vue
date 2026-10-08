<script setup lang="ts">
import { computed, ref } from 'vue';
import type { ModDisplay, StatMeta } from '@namearena/core';
import { getVfx } from './vfx';
import { sequencer } from './sequencer';
import type { UnitViewState } from './sequencer';
import GameIcon from '../components/GameIcon.vue';

const props = defineProps<{ unit: UnitViewState; statsMeta: StatMeta[]; display: ModDisplay; index: number }>();

/** 六维行与分档配色：键/标签由模组 display 声明，配色走 theme.css 的 .tier-* 全局类；
 *  键名与 icons.ts 同名（str/vit/int/spr/agi/luk），无对应图标时自动隐藏图标 */
const SIX = computed(() => props.display.sixStats);

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
  if (meta.format === 'pct') {
    return `${Math.round(v * 100)}%`;
  }
  return String(Math.round(v)); // 属性不显示小数（主人裁定 F45）
}

function tierLabel(key: string): string {
  return props.display.tierLabel(props.unit.tiers[key] ?? '');
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
        <span v-for="t in unit.tags" :key="t" class="pfill">{{ t }}</span>
        <span class="owner" v-if="unit.owner">{{ unit.owner }}</span>
      </div>

      <!-- 六维（模组声明的键与短标签，图标 + 分档配色） -->
      <div class="six-row">
        <span v-for="s in SIX" :key="s.key" class="six-item" :title="`${s.label} ${unit.base[s.key] ?? '·'} ${tierLabel(s.key)}`">
          <GameIcon :name="s.key" :size="11" class="six-ico" />
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
          <span class="bar-label">
            <GameIcon :name="meta.id === 'hp' ? 'heart' : 'mp'" :size="9" />
            {{ meta.label }} {{ Math.round(unit.stats[meta.id] ?? 0) }}/{{ Math.round(unit.stats[meta.barMaxStat ?? 'maxHp'] ?? 0) }}
          </span>
        </div>
      </div>

      <div class="pills">
        <span v-for="meta in pills" :key="meta.id" class="pill" :title="meta.label">
          {{ meta.label }} <b>{{ fmt(meta, unit) }}</b>
        </span>
      </div>

      <!-- 状态行 + 技能开关：同一行，开关靠右（主人拍板：不单独占行） -->
      <div class="status-line">
        <div class="status-row">
          <span v-for="s in unit.statuses" :key="s.id" class="status-ico" :class="s.kind" :title="`${s.name} ×${s.count}`">
            {{ s.kind === 'buff' ? '⬆' : '⬇' }}{{ s.name }}{{ s.count > 1 ? `×${s.count}` : '' }}
          </span>
        </div>
        <button type="button" class="ab-toggle" @click="abilitiesOpen = !abilitiesOpen">
          {{ abilitiesOpen ? '▾' : '▸' }} 技能 {{ unit.skills.length }}
        </button>
      </div>

      <div v-if="abilitiesOpen" class="ability-cards" style="grid-template-columns: 1fr">
        <div v-for="a in unit.skills" :key="a.id" class="ability-card mini" :title="a.desc">
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
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 3px;
  background: var(--bg-2);
  border: 1px solid var(--border-soft);
  border-radius: 6px;
  padding: 2px 0;
  line-height: 1.3;
}

.six-item .six-ico {
  color: var(--faint);
}

.six-item b {
  font-size: 13px;
}

/* 状态 + 技能开关同行：状态占左侧，开关贴右 */
.status-line {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-top: 5px;
  min-height: 18px;
}

.status-line .status-row {
  flex: 1;
  min-width: 0;
  margin-top: 0;
}

.ab-toggle {
  flex: none;
  display: inline-flex;
  align-items: center;
  gap: 3px;
  border: none;
  background: transparent;
  padding: 0 2px;
  font-size: 11px;
  color: var(--faint);
  cursor: pointer;
  user-select: none;
  transition: color var(--dur-1) var(--ease-out);
}

.ab-toggle:hover {
  color: var(--text);
}

/* 移动端精简（主人拍板 #61/#62）：小卡形态——只留 名字/职业、六维、生命、buff；
   技能与主人名不显示；六维 3x2 网格，血条随卡宽自然变短 */
@media (max-width: 899px) {
  .ab-toggle {
    display: none;
  }

  .ability-cards {
    display: none !important;
  }

  :deep(.owner) {
    display: none;
  }

  :deep(.name-row) {
    gap: 4px;
  }

  :deep(.name) {
    font-size: 12.5px;
  }

  :deep(.pfill) {
    font-size: 10px;
  }

  .six-row {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 3px;
  }

  .six-item {
    padding: 1px 0;
  }

  .six-item b {
    font-size: 12px;
  }

  :deep(.bar) {
    margin-top: 4px;
  }

  :deep(.status-row) {
    margin-top: 4px;
    min-height: 0;
  }

  :deep(.status-ico) {
    font-size: 10px;
    padding: 0 4px;
  }
}
</style>
