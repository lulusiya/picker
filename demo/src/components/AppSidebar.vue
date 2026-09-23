<script setup lang="ts">
const items = [
  { icon: '◧', label: 'Overview', current: true },
  { icon: '◇', label: 'Projects' },
  { icon: '↑', label: 'Deployments', count: 12 },
  { icon: '≡', label: 'Logs' },
  { icon: '◍', label: 'Usage' },
  { icon: '⚙', label: 'Settings' },
]
</script>

<template>
  <aside class="sidebar">
    <div class="brand">
      <span class="brand__mark">A</span>
      <span>Acme Console</span>
    </div>

    <div>
      <p class="nav__label">Workspace</p>
      <nav class="nav">
        <button
          v-for="item in items"
          :key="item.label"
          class="nav__item"
          type="button"
          :aria-current="item.current ? 'page' : undefined"
        >
          <span class="nav__icon" aria-hidden="true">{{ item.icon }}</span>
          <span>{{ item.label }}</span>
          <span v-if="item.count" class="nav__count">{{ item.count }}</span>
        </button>
      </nav>
    </div>

    <div class="sidebar__foot">
      <p>Hover any element and hold <code>Alt</code> to inspect it.</p>
      <p style="margin: 0; color: var(--faint)">vite-plugin-picker</p>
    </div>
  </aside>
</template>
