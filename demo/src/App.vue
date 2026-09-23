<script setup lang="ts">
import AppSidebar from './components/AppSidebar.vue'
import DeployTable from './components/DeployTable.vue'
import StatCard from './components/StatCard.vue'

const stats = [
  { label: 'Requests per minute', value: '12,480', delta: '8.2%', trend: 'up' },
  { label: 'p95 latency', value: '184 ms', delta: '12 ms', trend: 'up' },
  { label: 'Error rate', value: '0.12%', delta: '0.03%', trend: 'down' },
] as const
</script>

<template>
  <div class="shell">
    <AppSidebar />

    <div class="column">
      <header class="topbar">
        <div class="crumbs">
          <span>acme</span>
          <span aria-hidden="true">/</span>
          <strong>Overview</strong>
        </div>
        <div class="topbar__spacer"></div>
        <button class="btn" type="button">Docs</button>
        <button class="btn btn--primary" type="button">New deploy</button>
        <span class="avatar" title="lihuohuo">LH</span>
      </header>

      <main class="content">
        <div class="page-head">
          <h1>Overview</h1>
          <p>Production is healthy across 3 regions. Last incident 14 days ago.</p>
        </div>

        <div class="stats">
          <StatCard v-for="s in stats" :key="s.label" v-bind="s" />
        </div>

        <DeployTable />
      </main>
    </div>
  </div>
</template>
