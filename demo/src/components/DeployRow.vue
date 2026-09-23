<script setup lang="ts">
defineProps<{
  name: string
  branch: string
  status: 'ready' | 'building' | 'failed'
  duration: string
  when: string
  commit: string
  author: string
}>()

const labels = { ready: 'Ready', building: 'Building', failed: 'Failed' }
</script>

<template>
  <tr class="row">
    <td>
      <span class="row__name">{{ name }}</span>
      <span class="row__commit">{{ commit }}</span>
    </td>
    <td><span class="row__branch">{{ branch }}</span></td>
    <td>
      <span class="pill" :data-status="status">
        <span class="pill__dot" aria-hidden="true"></span>
        {{ labels[status] }}
      </span>
    </td>
    <td class="row__num">{{ duration }}</td>
    <td class="row__num row__when">{{ when }}</td>
    <td><span class="row__author">{{ author }}</span></td>
  </tr>
</template>

<style scoped>
.row__name {
  display: block;
  font-weight: 570;
}

.row__commit,
.row__branch {
  display: block;
  margin-top: 2px;
  color: var(--muted);
  font-family: var(--mono);
  font-size: 11.5px;
}

.row__num {
  font-variant-numeric: tabular-nums;
  color: var(--ink-2);
}

.row__when {
  color: var(--muted);
}

.row__author {
  display: inline-grid;
  place-items: center;
  width: 24px;
  height: 24px;
  border-radius: 999px;
  background: var(--surface-3);
  border: 1px solid var(--line);
  font-size: 10.5px;
  font-weight: 620;
  color: var(--ink-2);
}

.pill {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 9px 2px 7px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 550;
  background: var(--info-bg);
  color: var(--ink-2);
}

.pill__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: currentColor;
}

.pill[data-status='ready'] {
  background: var(--ok-bg);
  color: var(--ok);
}

.pill[data-status='building'] {
  background: var(--warn-bg);
  color: var(--warn);
}

.pill[data-status='failed'] {
  background: var(--err-bg);
  color: var(--err);
}
</style>
