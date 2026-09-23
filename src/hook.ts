#!/usr/bin/env node
import { collect, type HookFormat } from './hook-core'

function argValue(flag: string): string | undefined {
  const index = process.argv.indexOf(flag)
  return index !== -1 ? process.argv[index + 1] : undefined
}

/**
 * Hooks receive the event JSON on stdin. Draining it keeps the host from seeing
 * a broken pipe, but the wait is bounded: a stalled stdin must never hold up the
 * prompt it is attached to.
 */
function drainStdin(timeoutMs = 1000): Promise<void> {
  if (process.stdin.isTTY) return Promise.resolve()
  return new Promise(resolve => {
    let settled = false
    const finish = (): void => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      process.stdin.pause()
      resolve()
    }
    const timer = setTimeout(finish, timeoutMs)
    process.stdin.on('data', () => {})
    process.stdin.on('end', finish)
    process.stdin.on('close', finish)
    process.stdin.on('error', finish)
  })
}

async function main(): Promise<void> {
  await drainStdin()

  const agent = process.env.PICKER_AGENT?.trim() || argValue('--agent') || ''
  const root = process.env.PICKER_ROOT?.trim() || argValue('--root') || process.cwd()
  const format = (argValue('--format') ?? process.env.PICKER_HOOK_FORMAT ?? 'text') as HookFormat

  const result = collect({ agent, root, format, force: process.argv.includes('--force') })
  if (result) process.stdout.write(result.payload)
}

main().catch(error => {
  // Never fail: a non-zero exit rejects the prompt in Claude Code and blocks it
  // in Codex, so a broken hook would break the developer's session.
  console.error('[picker-hook]', error instanceof Error ? error.message : error)
  process.exitCode = 0
})
