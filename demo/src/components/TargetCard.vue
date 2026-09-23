<script setup lang="ts">
defineProps<{
  title: string
  description: string
  tone: 'source' | 'range'
}>()
</script>

<template>
  <article class="target-card">
    <div class="target-card__meta">
      <span class="target-card__signal" :data-tone="tone"></span>
      <span>{{ tone === 'source' ? '源码定位' : '组件层级' }}</span>
    </div>
    <h2>{{ title }}</h2>
    <p>{{ description }}</p>
    <button type="button">可选中的内部按钮</button>
  </article>
</template>
