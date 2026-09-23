import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { collect, composePayload, readPushControl, renderPayload } from '../src/hook-core'

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'picker-hook-'))
})

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true })
})

/** Writes a snapshot and pins its mtime so ordering is deterministic. */
function writeSnapshot(relPath: string, body: string, mtimeMs?: number): string {
  const file = path.join(root, relPath)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, body)
  if (mtimeMs !== undefined) {
    const seconds = mtimeMs / 1000
    fs.utimesSync(file, seconds, seconds)
  }
  return file
}

function writePush(stateDir: string, once: number, target = ''): void {
  fs.mkdirSync(path.join(root, stateDir), { recursive: true })
  fs.writeFileSync(path.join(root, stateDir, 'push.json'), JSON.stringify({ once, target }))
}

const stateDir = '.picker'

describe('composePayload', () => {
  it('names the inbox file when the pick was routed', () => {
    const text = composePayload('codex', path.join(root, stateDir, 'inbox', 'codex.md'), 'body')
    expect(text).toContain('agent=codex')
    expect(text).toContain('来源=codex.md')
    expect(text).toContain('body')
  })

  it('falls back to the broadcast label', () => {
    const text = composePayload('', path.join(root, stateDir, 'last-pick.md'), 'body')
    expect(text).toContain('agent=agent')
    expect(text).toContain('来源=last-pick.md')
  })
})

describe('renderPayload', () => {
  it('emits plain stdout for claude, which adds it to the prompt context', () => {
    const out = renderPayload('text', 'claude', path.join(root, stateDir, 'last-pick.md'), 'body')
    expect(out.startsWith('🖱️ Picker 选取')).toBe(true)
    expect(() => JSON.parse(out)).toThrow()
  })

  it('emits the json envelope codex requires, since it ignores plain stdout', () => {
    const out = renderPayload('codex', 'codex', path.join(root, stateDir, 'inbox', 'codex.md'), 'body')
    const parsed = JSON.parse(out)
    expect(parsed.hookSpecificOutput.hookEventName).toBe('UserPromptSubmit')
    expect(parsed.hookSpecificOutput.additionalContext).toContain('agent=codex')
    expect(parsed.hookSpecificOutput.additionalContext).toContain('body')
  })
})

describe('readPushControl', () => {
  it('tolerates a missing or malformed file', () => {
    expect(readPushControl(path.join(root, stateDir))).toEqual({ once: 0, target: '' })
    fs.mkdirSync(path.join(root, stateDir), { recursive: true })
    fs.writeFileSync(path.join(root, stateDir, 'push.json'), 'not json')
    expect(readPushControl(path.join(root, stateDir))).toEqual({ once: 0, target: '' })
  })
})

describe('collect', () => {
  it('does nothing without state', () => {
    expect(collect({ agent: 'codex', root, format: 'text' })).toBeNull()
  })

  it('delivers a snapshot once and then stays quiet', () => {
    writeSnapshot(`${stateDir}/last-pick.md`, 'first pick')
    const first = collect({ agent: 'codex', root, format: 'text' })
    expect(first?.payload).toContain('first pick')
    expect(collect({ agent: 'codex', root, format: 'text' })).toBeNull()
  })

  it('delivers again when the snapshot changes', () => {
    writeSnapshot(`${stateDir}/last-pick.md`, 'first pick', 1_000_000)
    collect({ agent: 'codex', root, format: 'text' })
    writeSnapshot(`${stateDir}/last-pick.md`, 'second pick', 2_000_000)
    expect(collect({ agent: 'codex', root, format: 'text' })?.payload).toContain('second pick')
  })

  it('remembers delivery per agent', () => {
    writeSnapshot(`${stateDir}/inbox/claude.md`, 'for claude')
    expect(collect({ agent: 'claude', root, format: 'text' })?.payload).toContain('for claude')
    // a different agent has its own cursor, so it still sees the broadcast file
    writeSnapshot(`${stateDir}/last-pick.md`, 'for everyone')
    expect(collect({ agent: 'codex', root, format: 'codex' })?.payload).toContain('for everyone')
  })

  it('prefers the agent inbox over an older broadcast', () => {
    writeSnapshot(`${stateDir}/last-pick.md`, 'broadcast', 1_000_000)
    writeSnapshot(`${stateDir}/inbox/codex.md`, 'targeted', 2_000_000)
    expect(collect({ agent: 'codex', root, format: 'text' })?.payload).toContain('targeted')
  })

  it('re-delivers when the browser pushes the same pick again', () => {
    writeSnapshot(`${stateDir}/inbox/codex.md`, 'same pick', 1_000_000)
    collect({ agent: 'codex', root, format: 'text' })
    expect(collect({ agent: 'codex', root, format: 'text' })).toBeNull()

    writePush(stateDir, 5000, 'codex')
    expect(collect({ agent: 'codex', root, format: 'text' })?.payload).toContain('same pick')
    expect(collect({ agent: 'codex', root, format: 'text' })).toBeNull()
  })

  it('ignores a push aimed at another agent', () => {
    writeSnapshot(`${stateDir}/inbox/codex.md`, 'same pick', 1_000_000)
    collect({ agent: 'codex', root, format: 'text' })
    writePush(stateDir, 5000, 'claude')
    expect(collect({ agent: 'codex', root, format: 'text' })).toBeNull()
  })

  it('skips an empty snapshot', () => {
    writeSnapshot(`${stateDir}/last-pick.md`, '   \n')
    expect(collect({ agent: 'codex', root, format: 'text' })).toBeNull()
  })

  it('emits again when forced', () => {
    writeSnapshot(`${stateDir}/last-pick.md`, 'pick')
    collect({ agent: 'codex', root, format: 'text' })
    expect(collect({ agent: 'codex', root, format: 'text', force: true })?.payload).toContain('pick')
  })

  it('finds state below the given root, like a monorepo package', () => {
    writeSnapshot('demo/.picker/last-pick.md', 'nested pick')
    expect(collect({ agent: 'codex', root, format: 'text' })?.payload).toContain('nested pick')
  })

  it('finds state above the given root, like a hook started in a subdirectory', () => {
    writeSnapshot(`${stateDir}/last-pick.md`, 'from parent')
    const nestedRoot = path.join(root, 'src', 'components')
    fs.mkdirSync(nestedRoot, { recursive: true })
    expect(collect({ agent: 'codex', root: nestedRoot, format: 'text' })?.payload).toContain('from parent')
  })
})
