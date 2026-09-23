<script setup lang="ts">
defineProps<{
  label: string
  value: string
  delta: string
  trend: 'up' | 'down'
}>()
</script>

<template>
  <article class="stat">
    <p class="stat__label">{{ label }}</p>
    <p class="stat__value">{{ value }}</p>
    <p class="stat__delta" :data-trend="trend">
      <span aria-hidden="true">{{ trend === 'up' ? '▲' : '▼' }}</span>
      <span>{{ delta }}</span>
      <span class="stat__period">vs. previous hour</span>
    </p>
  </article>
</template>

<style scoped>
.stat {
  padding: 14px 16px 16px;
  border: 1px solid var(--line);
  border-radius: var(--radius-lg);
  background: var(--surface);
  box-shadow: var(--shadow-sm);
}

.stat__label {
  margin: 0;
  color: var(--muted);
  font-size: 12px;
  font-weight: 550;
  letter-spacing: 0.01em;
}

.stat__value {
  margin: 6px 0 8px;
  font-size: 30px;
  font-weight: 620;
  line-height: 1.15;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}

.stat__delta {
  display: flex;
  align-items: center;
  gap: 6px;
  margin: 0;
  font-size: 13px;
  font-weight: 550;
  color: var(--muted);
}

.stat__delta[data-trend='up'] span:first-child {
  color: var(--ok);
}

.stat__delta[data-trend='down'] span:first-child {
  color: var(--err);
}

.stat__period {
  color: var(--faint);
  font-size: 11.5px;
  font-weight: 400;
}
</style>
