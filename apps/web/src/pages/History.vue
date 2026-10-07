<script setup lang="ts">
import { onActivated, ref } from 'vue';
import { getMod } from '@namearena/core';
import { api, type BattleListItem } from '../api';

const list = ref<BattleListItem[]>([]);
const error = ref('');

async function load() {
  try {
    list.value = await api.battles();
  } catch (e) {
    error.value = (e as Error).message;
  }
}

// keep-alive：每次切回战报页都刷新列表
onActivated(load);

function time(t: string): string {
  return new Date(t).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/** 计数单位随模组（normal=回合，fantasy=行动） */
function roundLabel(modId: string): string {
  try {
    return getMod(modId).display.roundLabel;
  } catch {
    return '回合';
  }
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">📜 历史战报</div>
    <div class="muted" style="margin-bottom: 8px">战报只存「配置 + 种子」，点开时本地重演——想看多久之前的都行。</div>
    <div v-if="error" class="error-text">{{ error }}</div>
    <div v-for="b in list" :key="b.id" class="list-row">
      <router-link :to="`/battle/${b.id}`" style="flex: 1">
        <div class="row" style="justify-content: space-between">
          <div>
            <b :style="{ color: 'var(--side-a)' }">{{ b.teams.find((t) => t.side === 'A')?.names.join('·') }}</b>
            <span class="muted" style="margin: 0 4px">vs</span>
            <b :style="{ color: 'var(--side-b)' }">{{ b.teams.find((t) => t.side === 'B')?.names.join('·') }}</b>
          </div>
          <div style="text-align: right">
            <span class="tag" :class="{ gold: b.winner === 'A' }">{{ b.winner === 'A' ? 'A 胜' : b.winner === 'B' ? 'B 胜' : '平局' }}</span>
            <span class="muted" style="margin-left: 6px">{{ b.rounds }}{{ roundLabel(b.modId) }}</span>
          </div>
        </div>
        <div class="muted" style="font-size: 11px; margin-top: 2px">
          {{ b.modId }} · {{ time(b.createdAt) }} · 点击重演
        </div>
      </router-link>
    </div>
    <div v-if="!error && list.length === 0" class="muted empty">还没有对局，去竞技场打一场吧</div>
  </div>
</template>
