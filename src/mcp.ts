#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { createPickAiServer } from './mcp-server'

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

async function main(): Promise<void> {
  const root = process.env.PICK_AI_ROOT?.trim() || argValue('--root') || process.cwd()
  const agent = process.env.PICK_AI_AGENT?.trim() || argValue('--agent')
  const server = createPickAiServer({ root, agent })
  await server.connect(new StdioServerTransport())
}

main().catch(error => {
  console.error('[pick-ai-mcp]', error)
  process.exit(1)
})
