import { promises as fsp } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { findStateDirs, formatPick, matchesAgent, readPicks } from '../src/bridge'
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

async function writePicks(dir: string, picks: PickEntry[]): Promise<void> {
  await fsp.mkdir(path.join(dir, '.picker'), { recursive: true })
  const body = picks.map(pick => JSON.stringify(pick)).join('\n')
  await fsp.writeFile(path.join(dir, '.picker', 'picks.jsonl'), body ? `${body}\n` : '')
}

let root: string
beforeEach(async () => {
  root = await fsp.mkdtemp(path.join(os.tmpdir(), 'picker-bridge-'))
})
afterEach(async () => {
  await fsp.rm(root, { recursive: true, force: true })
})

describe('findStateDirs', () => {
  it('finds nested .picker directories', async () => {
    await writePicks(path.join(root, 'demo'), [])
    expect(findStateDirs(root)).toEqual([path.join(root, 'demo', '.picker')])
  })

  it('skips node_modules and dot directories', async () => {
    await fsp.mkdir(path.join(root, 'node_modules', '.picker'), { recursive: true })
    await fsp.mkdir(path.join(root, '.cache', '.picker'), { recursive: true })
    await fsp.mkdir(path.join(root, 'app', '.picker'), { recursive: true })
    expect(findStateDirs(root)).toEqual([path.join(root, 'app', '.picker')])
  })
})

describe('matchesAgent', () => {
  it('matches broadcasts for everyone and targets only for the target', () => {
    expect(matchesAgent(entry({ seq: 1, time: 1 }), 'codex')).toBe(true)
    expect(matchesAgent(entry({ seq: 2, time: 2, targets: ['codex'] }), 'codex')).toBe(true)
    expect(matchesAgent(entry({ seq: 3, time: 3, targets: ['pi'] }), 'codex')).toBe(false)
    expect(matchesAgent(entry({ seq: 4, time: 4, targets: ['pi'] }))).toBe(true)
  })
})

describe('readPicks', () => {
  it('reads, filters by agent and sorts oldest first', async () => {
    await writePicks(root, [
      entry({ seq: 2, time: 20, targets: ['pi'] }),
      entry({ seq: 1, time: 10 }),
      entry({ seq: 3, time: 30, targets: ['codex'] }),
    ])
    expect(readPicks({ root, agent: 'codex' }).map(pick => pick.seq)).toEqual([1, 3])
    expect(readPicks({ root }).map(pick => pick.seq)).toEqual([1, 2, 3])
  })

  it('returns nothing when there is no state', () => {
    expect(readPicks({ root })).toEqual([])
  })
})

describe('formatPick', () => {
  it('renders src, range, targets and instruction', () => {
    const text = formatPick(
      entry({ seq: 5, time: 5, chain: 'App > Card', instruction: 'make it blue', targets: ['codex'], kind: 'prompt' }),
    )
    expect(text).toContain('src: /p/App.vue:5:1')
    expect(text).toContain('range: App > Card')
    expect(text).toContain('targets: codex')
    expect(text).toContain('make it blue')
  })
})
