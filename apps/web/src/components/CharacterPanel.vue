<script setup lang="ts">
import { computed } from 'vue';
import { applyPassiveMods, getAbility, STAT_TIERS } from '@namearena/core';
import type { Character, StatId } from '@namearena/core';

/**
 * 角色详情面板：六维（分档配色）+ 战斗属性 + 能力（名字 + 主动/被动，不展开描述）。
 * 取名实验室与队伍展开详情共用。
 * 注意：Boolean prop 未传时会被 Vue 转成 false，必须用 withDefaults 给 true。
 */
const props = withDefaults(
  defineProps<{ char: Character; showAbilities?: boolean }>(),
  { showAbilities: true },
);

const STAT_LABELS: Record<StatId, string> = {
  str: '力量',
  wis: '智慧',
  vit: '体力',
  spr: '精神',
  agi: '敏捷',
  luk: '幸运',
};

function tierColor(id: string): { color: string; label: string } {
  const t = STAT_TIERS.find((x) => x.id === id);
  return { color: t?.color ?? '#9ca3af', label: t?.label ?? '' };
}

const personality = computed(() => {
  const map: Record<string, string> = {
    aggressive: '🔥激进',
    conservative: '🛡️保守',
    chaotic: '🎲搞事',
    steady: '⚖️沉稳',
  };
  return map[props.char.personalityId] ?? props.char.personalityId;
});

const finalDerived = computed(() => applyPassiveMods(props.char.derived, props.char.abilities));

const derivedList = computed(() => {
  const d = finalDerived.value;
  return [
    { label: '生命', v: Math.round(d.maxHp) },
    { label: '法力', v: Math.round(d.maxMp) },
    { label: '攻击', v: Math.round(d.atk) },
    { label: '魔攻', v: Math.round(d.mag) },
    { label: '物防', v: Math.round(d.pdef) },
    { label: '魔防', v: Math.round(d.mdef) },
    { label: '速度', v: Math.round(d.spd * 10) / 10 },
    { label: '闪避', v: `${Math.round(d.dodge * 100)}%` },
    { label: '暴击', v: `${Math.round(d.crit * 100)}%` },
    { label: '暴伤', v: `${Math.round(d.critDmg * 100)}%` },
  ];
});

const abilityRows = computed(() =>
  props.char.abilities.map((a) => {
    const def = getAbility(a.id);
    return {
      id: a.id,
      name: def?.name ?? a.id,
      desc: def?.desc ?? '',
      kind: def?.kind ?? 'passive',
      cost: def?.cost ?? 0,
    };
  }),
);
</script>

<template>
  <div>
    <div class="row" style="justify-content: space-between; margin-bottom: 4px">
      <div class="name-row" style="display: flex; gap: 6px; align-items: baseline">
        <b style="font-size: 15px">{{ char.name }}</b>
        <span class="tag">cost {{ char.totalCost }}</span>
        <span class="tag gold">{{ personality }}</span>
      </div>
    </div>

    <div class="row" style="gap: 4px; margin-bottom: 8px">
      <div
        v-for="(label, key) in STAT_LABELS"
        :key="key"
        style="text-align: center; flex: 1; min-width: 44px"
        :title="tierColor(char.tiers[key as StatId]).label"
      >
        <div class="muted" style="font-size: 11px">{{ label }}</div>
        <div style="font-weight: 800; font-size: 18px" :style="{ color: tierColor(char.tiers[key as StatId]).color }">
          {{ char.base[key as StatId] }}
        </div>
      </div>
    </div>

    <div class="pills" style="margin: 0 0 4px">
      <span v-for="d in derivedList" :key="d.label" class="pill">{{ d.label }} <b>{{ d.v }}</b></span>
    </div>

    <div v-if="showAbilities !== false" class="ability-cards">
      <div v-for="a in abilityRows" :key="a.id" class="ability-card">
        <div class="head">
          <span class="tag kinds" :class="a.kind === 'active' ? 'gold' : 'passive'">{{ a.kind === 'active' ? '主动' : '被动' }}</span>
          <b>{{ a.name }}</b>
          <span v-if="a.cost > 0" class="muted" style="font-size: 11px">cost {{ a.cost }}</span>
        </div>
        <div class="desc">{{ a.desc }}</div>
      </div>
    </div>
  </div>
</template>
