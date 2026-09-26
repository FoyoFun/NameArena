<script setup lang="ts">
import { onActivated, ref } from 'vue';
import { api, type LadderRow } from '../api';

const rows = ref<LadderRow[]>([]);
const modId = ref('normal-pvp');
const error = ref('');

async function refresh() {
  try {
    rows.value = await api.ladder(modId.value, 1);
  } catch (e) {
    error.value = (e as Error).message;
  }
}

// keep-alive：每次切回天梯页都刷新
onActivated(refresh);

function medal(i: number): string {
  return ['🥇', '🥈', '🥉'][i] ?? `${i + 1}`;
}
</script>

<template>
  <div class="panel">
    <div class="panel-title">🏆 名字天梯</div>
    <div class="row" style="margin-bottom: 10px">
      <button class="btn small" :class="{ primary: modId === 'normal-pvp' }" @click="((modId = 'normal-pvp'), refresh())">常规PVP</button>
      <button class="btn small" :class="{ primary: modId === 'normal-pve' }" @click="((modId = 'normal-pve'), refresh())">常规PVE</button>
      <span class="muted">同名永远同角色——这个榜就是全服的挖名字藏宝图</span>
    </div>
    <div v-if="error" class="error-text">{{ error }}</div>
    <table v-if="rows.length" class="list">
      <thead>
        <tr>
          <th>#</th>
          <th>名字</th>
          <th>场次</th>
          <th>胜/负</th>
          <th>胜率</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="(r, i) in rows" :key="r.name">
          <td>{{ medal(i) }}</td>
          <td><b>{{ r.name }}</b></td>
          <td>{{ r.battles }}</td>
          <td>{{ r.wins }}/{{ r.losses }}</td>
          <td><b>{{ Math.round(r.winrate * 100) }}%</b></td>
        </tr>
      </tbody>
    </table>
    <div v-else class="muted" style="text-align: center; padding: 20px">还没有数据，打几场就有了</div>
  </div>
</template>
