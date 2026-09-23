import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { formatPick, readPicks } from './bridge'

export interface PickerServerOptions {
  /** Project root to search for `.picker` state from. */
  root: string
  /** Agent name used to filter targeted picks. Omit to receive everything. */
  agent?: string
}

/** Builds the Picker MCP server. Transport is wired up by the caller. */
export function createPickerServer(options: PickerServerOptions): McpServer {
  const server = new McpServer({ name: 'picker', version: '0.5.0' })
  let cursor = 0

  const picks = () => readPicks({ root: options.root, agent: options.agent })
  const text = (value: string) => ({ content: [{ type: 'text' as const, text: value }] })

  server.registerTool(
    'get_new_picks',
    {
      description:
        'Return elements picked in the browser since the previous call. Call this before acting on a change requested from the browser.',
    },
    async () => {
      const fresh = picks().filter(entry => entry.seq > cursor)
      if (fresh.length) cursor = Math.max(...fresh.map(entry => entry.seq))
      if (!fresh.length) return text('No new browser picks since the last call.')
      return text(fresh.map(formatPick).join('\n\n---\n\n'))
    },
  )

  server.registerTool(
    'get_last_pick',
    {
      description: 'Return the most recent element picked in the browser, regardless of read state.',
    },
    async () => {
      const all = picks()
      const last = all[all.length - 1]
      return text(last ? formatPick(last) : 'No browser picks found yet.')
    },
  )

  server.registerTool(
    'list_picks',
    {
      description: 'List recent browser picks, newest first.',
      inputSchema: { limit: z.number().int().positive().max(100).optional() },
    },
    async ({ limit }) => {
      const recent = picks().slice(-(limit ?? 10)).reverse()
      if (!recent.length) return text('No browser picks found yet.')
      return text(recent.map(entry => `#${entry.seq}\n${formatPick(entry)}`).join('\n\n---\n\n'))
    },
  )

  return server
}
