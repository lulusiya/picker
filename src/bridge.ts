import fs from 'node:fs'
import path from 'node:path'
import { parseEntries, type PickEntry } from './state'

const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage'])
const DEFAULT_MAX_DEPTH = 3

/** Finds every `.pick-ai` directory near a project root (bounded search). */
export function findStateDirs(root: string, maxDepth = DEFAULT_MAX_DEPTH): string[] {
  const found: string[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (queue.length) {
    const { dir, depth } = queue.shift()!
    if (fs.existsSync(path.join(dir, '.pick-ai'))) found.push(path.join(dir, '.pick-ai'))
    if (depth >= maxDepth) continue
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || SKIP.has(entry.name)) continue
      queue.push({ dir: path.join(dir, entry.name), depth: depth + 1 })
    }
  }
  return found
}

/** A pick is relevant when it targets this agent or was broadcast. */
export function matchesAgent(entry: PickEntry, agent?: string): boolean {
  if (!agent) return true
  return entry.targets.length === 0 || entry.targets.includes(agent)
}

export interface ReadPicksOptions {
  root: string
  agent?: string
  stateDir?: string
  maxDepth?: number
}

/** Reads every pick from the bridge, oldest first, optionally filtered by agent. */
export function readPicks(options: ReadPicksOptions): PickEntry[] {
  const dirs = options.stateDir ? [options.stateDir] : findStateDirs(options.root, options.maxDepth)
  const picks: PickEntry[] = []
  for (const dir of dirs) {
    try {
      picks.push(...parseEntries(fs.readFileSync(path.join(dir, 'picks.jsonl'), 'utf8')))
    } catch {
      // No log in this directory yet.
    }
  }
  return picks.filter(entry => matchesAgent(entry, options.agent)).sort((a, b) => a.time - b.time || a.seq - b.seq)
}

/** Renders a pick as an AI-friendly block. */
export function formatPick(entry: PickEntry): string {
  const lines = [
    `src: ${entry.file}:${entry.line}:${entry.column}`,
    `range: ${entry.chain ?? entry.component ?? 'UnknownComponent'}`,
    `kind: ${entry.kind}`,
  ]
  if (entry.targets.length) lines.push(`targets: ${entry.targets.join(', ')}`)
  if (entry.instruction) lines.push('', 'instruction:', entry.instruction)
  return lines.join('\n')
}
