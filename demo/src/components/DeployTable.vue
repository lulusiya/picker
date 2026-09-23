<script setup lang="ts">
import DeployRow from './DeployRow.vue'

const deployments = [
  { name: 'web-prod', branch: 'main', status: 'ready', duration: '42s', when: '2 min ago', commit: '9f31ac2', author: 'LH' },
  { name: 'api-staging', branch: 'feat/rate-limit', status: 'building', duration: '1m 08s', when: '5 min ago', commit: 'c4e7b10', author: 'YW' },
  { name: 'docs-site', branch: 'main', status: 'ready', duration: '18s', when: '26 min ago', commit: '7b2d844', author: 'LH' },
  { name: 'worker-eu', branch: 'fix/backoff', status: 'failed', duration: '9s', when: '1 hr ago', commit: 'a10f5c9', author: 'MZ' },
] as const
</script>

<template>
  <section class="panel">
    <header class="panel__head">
      <h2>Recent deployments</h2>
      <span>4 of 128</span>
      <button class="btn" type="button">Filter</button>
    </header>

    <table class="table">
      <thead>
        <tr>
          <th>Service</th>
          <th>Branch</th>
          <th>Status</th>
          <th>Build</th>
          <th>Deployed</th>
          <th>By</th>
        </tr>
      </thead>
      <tbody>
        <DeployRow v-for="d in deployments" :key="d.name" v-bind="d" />
      </tbody>
    </table>
  </section>
</template>

<style scoped>
.table {
  width: 100%;
  border-collapse: collapse;
}

.table th {
  padding: 9px 16px;
  border-bottom: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  text-align: left;
}

.table td {
  padding: 11px 16px;
  border-bottom: 1px solid var(--line);
  vertical-align: middle;
}

.table tbody tr:last-child td {
  border-bottom: 0;
}

.table tbody tr:hover {
  background: var(--surface-2);
}
</style>
