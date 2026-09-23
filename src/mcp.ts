#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createPickerServer } from './mcp-server'

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

async function main(): Promise<void> {
  const root = process.env.PICKER_ROOT?.trim() || argValue('--root') || process.cwd()
  const agent = process.env.PICKER_AGENT?.trim() || argValue('--agent')
  const server = createPickerServer({ root, agent })
  await server.connect(new StdioServerTransport())
}

main().catch(error => {
  console.error('[picker-mcp]', error)
  process.exit(1)
})
