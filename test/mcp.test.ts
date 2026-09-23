import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createPickerServer } from '../src/mcp-server'
import type { PickEntry } from '../src/state'

function entry(partial: Partial<PickEntry> & { seq: number; time: number }): PickEntry {
  return {
    kind: 'pick',
    id: `id-${partial.seq}`,
    file: '/p/App.vue',
    line: partial.seq,
    column: 1,
    range: { start: { line: partial.seq, column: 1 }, end: { line: partial.seq, column: 9 } },
    targets: [],
    ...partial,
  }
}

async function writePicks(picks: PickEntry[]): Promise<void> {
  await fsp.mkdir(path.join(root, '.picker'), { recursive: true })
  await fsp.writeFile(path.join(root, '.picker', 'picks.jsonl'), `${picks.map(p => JSON.stringify(p)).join('\n')}\n`)
}

let root: string
beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'picker-mcp-'))
})
afterEach(async () => {
  await fsp.rm(root, { recursive: true, force: true })
})

async function connect(agent?: string) {
  const server = createPickerServer({ root, agent })
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair()
  await server.connect(serverTransport)
  const client = new Client({ name: 'test-client', version: '1.0.0' })
  await client.connect(clientTransport)
  return { server, client }
}

describe('picker MCP server', () => {
  it('reports the same version as the package', async () => {
    const pkg = JSON.parse(await fsp.readFile(new URL('../package.json', import.meta.url), 'utf8')) as { version: string }
    const { server, client } = await connect('codex')
    try {
      expect(client.getServerVersion()?.version).toBe(pkg.version)
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('lists tools and serves picks, advancing a per-session cursor', async () => {
    await writePicks([
      entry({ seq: 1, time: 10, instruction: 'broadcast edit', kind: 'prompt' }),
      entry({ seq: 2, time: 20, targets: ['codex'], instruction: 'make it blue', kind: 'prompt' }),
    ])
    const { server, client } = await connect('codex')
    try {
      const tools = await client.listTools()
      expect(tools.tools.map(tool => tool.name).sort()).toEqual(['get_last_pick', 'get_new_picks', 'list_picks'])

      const last = await client.callTool({ name: 'get_last_pick', arguments: {} })
      expect(JSON.stringify(last.content)).toContain('make it blue')

      const fresh = await client.callTool({ name: 'get_new_picks', arguments: {} })
      expect(JSON.stringify(fresh.content)).toContain('make it blue')

      const again = await client.callTool({ name: 'get_new_picks', arguments: {} })
      expect(JSON.stringify(again.content)).toContain('No new browser picks')
    } finally {
      await client.close()
      await server.close()
    }
  })

  it('hides picks targeted at other agents', async () => {
    await writePicks([entry({ seq: 1, time: 10, targets: ['pi'], instruction: 'pi only', kind: 'prompt' })])
    const { server, client } = await connect('codex')
    try {
      const last = await client.callTool({ name: 'get_last_pick', arguments: {} })
      expect(JSON.stringify(last.content)).not.toContain('pi only')
      expect(JSON.stringify(last.content)).toContain('No browser picks found')
    } finally {
      await client.close()
      await server.close()
    }
  })
})
