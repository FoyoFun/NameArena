<script setup lang="ts">
import { onActivated, ref } from 'vue';
import { getMod } from '@namearena/core';
import { api, type BattleListItem } from '../api';
import GameIcon from '../components/GameIcon.vue';
import PageHero from '../components/PageHero.vue';

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
  <PageHero icon="report" title="历史战报" subtitle="战报只存「配置 + 种子」，点开时本地重演——想看多久之前的都行" />

  <div class="panel">
    <div class="panel-head">
      <span class="t"><GameIcon name="report" :size="14" />对局列表</span>
      <span class="acts"><span class="tag">{{ list.length }} 场</span></span>
    </div>

    <div v-if="error" class="error-text">{{ error }}</div>

    <div class="scroll-y history-scroll">
      <router-link v-for="b in list" :key="b.id" :to="`/battle/${b.id}`" class="hist-row">
        <GameIcon name="swords" :size="14" class="hist-ico" />
        <div class="hist-main">
          <div class="hist-names">
            <b :style="{ color: 'var(--side-a)' }">{{ b.teams.find((t) => t.side === 'A')?.names.join('·') }}</b>
            <span class="muted" style="margin: 0 4px">vs</span>
            <b :style="{ color: 'var(--side-b)' }">{{ b.teams.find((t) => t.side === 'B')?.names.join('·') }}</b>
          </div>
          <div class="muted" style="font-size: 11px; margin-top: 2px">
            {{ b.modId }} · {{ time(b.createdAt) }}
          </div>
        </div>
        <div class="hist-right">
          <span class="tag" :class="b.winner === 'A' ? 'gold' : b.winner === 'B' ? 'passive' : ''">
            {{ b.winner === 'A' ? 'A 胜' : b.winner === 'B' ? 'B 胜' : '平局' }}
          </span>
          <span class="muted" style="font-size: 11px">{{ b.rounds }}{{ roundLabel(b.modId) }} · 点击重演</span>
        </div>
      </router-link>
      <div v-if="!error && list.length === 0" class="muted empty">还没有对局，去竞技场打一场吧</div>
    </div>
  </div>
</template>

<style scoped>
.history-scroll {
  max-height: 68vh;
}

.hist-row {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 2px;
  border-bottom: 1px solid var(--border-soft);
  color: var(--text);
  transition: background-color var(--dur-1) var(--ease-out);
}

.hist-row:hover {
  background: rgba(255, 255, 255, 0.03);
}

.hist-row:last-child {
  border-bottom: none;
}

.hist-ico {
  color: var(--faint);
  flex: none;
}

.hist-main {
  flex: 1;
  min-width: 0;
}

.hist-names {
  font-size: 13px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hist-right {
  flex: none;
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 2px;
}
</style>
