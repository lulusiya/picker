import { describe, expect, it } from 'vitest'
import { buildPickEntry, defaultPushControl, normalizeTargets, parseEntries, parsePushControl, renderLastPick, sanitizeTarget, type RecordPayload } from '../src/state'
import type { SourceRecord } from '../src/transform'

const record: SourceRecord = {
  file: 'C:\\project\\src\\App.vue',
  line: 12,
  column: 3,
  range: { start: { line: 12, column: 3 }, end: { line: 12, column: 40 } },
  component: 'App',
}

describe('buildPickEntry', () => {
  it('records a plain pick without an instruction', () => {
    const entry = buildPickEntry(record, { kind: 'pick' } as RecordPayload, 'abc:12:3', 1, 1000)
    expect(entry).toMatchObject({ seq: 1, kind: 'pick', id: 'abc:12:3', file: record.file, line: 12, column: 3 })
    expect(entry.instruction).toBeUndefined()
    expect(entry.prompt).toBeUndefined()
  })

  it('composes a prompt when an instruction is provided', () => {
    const entry = buildPickEntry(
      record,
      { kind: 'prompt', instruction: '  make it blue  ', chain: 'App > Card' },
      'abc:12:3',
      2,
      2000,
    )
    expect(entry.kind).toBe('prompt')
    expect(entry.instruction).toBe('make it blue')
    expect(entry.prompt).toBe('make it blue\n\nsrc: C:\\project\\src\\App.vue:12:3\nrange: App > Card')
  })

  it('downgrades an empty prompt to a plain pick', () => {
    const entry = buildPickEntry(record, { kind: 'prompt', instruction: '   ' }, 'abc:12:3', 3, 3000)
    expect(entry.kind).toBe('pick')
  })
})

describe('renderLastPick', () => {
  it('renders the source location, chain and instruction', () => {
    const md = renderLastPick(
      buildPickEntry(record, { kind: 'prompt', instruction: 'make it blue', chain: 'App > Card' }, 'abc:12:3', 7, 0),
    )
    expect(md).toContain('# Pick AI · seq 7')
    expect(md).toContain('`C:\\project\\src\\App.vue:12:3`')
    expect(md).toContain('- **range**: App > Card')
    expect(md).toContain('make it blue')
  })
})

describe('parseEntries', () => {
  it('skips blank and malformed lines', () => {
    const jsonl = '{"seq":1}\n\nnot json\n{"seq":2}\n'
    expect(parseEntries(jsonl).map(entry => entry.seq)).toEqual([1, 2])
  })
})

describe('targets', () => {
  it('sanitises safe names and rejects unsafe ones', () => {
    expect(sanitizeTarget('codex')).toBe('codex')
    expect(sanitizeTarget('my-agent_1')).toBe('my-agent_1')
    expect(sanitizeTarget('../etc/passwd')).toBeUndefined()
    expect(sanitizeTarget('a b')).toBeUndefined()
    expect(sanitizeTarget('')).toBeUndefined()
    expect(sanitizeTarget(42)).toBeUndefined()
  })

  it('normalises, de-duplicates and preserves order', () => {
    expect(normalizeTargets(['codex', 'pi', 'codex', 'bad name', 7])).toEqual(['codex', 'pi'])
    expect(normalizeTargets('codex')).toEqual([])
  })

  it('routes an entry to a target and marks broadcast otherwise', () => {
    expect(buildPickEntry(record, { kind: 'pick' }, 'abc', 1, 0, 'codex').targets).toEqual(['codex'])
    expect(buildPickEntry(record, { kind: 'pick' }, 'abc', 1, 0).targets).toEqual([])
  })

  it('shows the target in the rendered snapshot', () => {
    expect(renderLastPick(buildPickEntry(record, { kind: 'pick' }, 'abc', 1, 0, 'codex'))).toContain('- **target**: codex')
    expect(renderLastPick(buildPickEntry(record, { kind: 'pick' }, 'abc', 1, 0))).toContain('- **target**: 全部')
  })
})

describe('parsePushControl', () => {
  it('defaults to no pending push and tolerates malformed input', () => {
    expect(defaultPushControl()).toEqual({ once: 0, target: '' })
    expect(parsePushControl('')).toEqual({ once: 0, target: '' })
    expect(parsePushControl('not json')).toEqual({ once: 0, target: '' })
    expect(parsePushControl('{}')).toEqual({ once: 0, target: '' })
  })

  it('reads once and target, ignoring wrong types', () => {
    expect(parsePushControl('{"once":123,"target":"codex"}')).toEqual({ once: 123, target: 'codex' })
    expect(parsePushControl('{"once":-1,"target":7}')).toEqual({ once: 0, target: '' })
  })
})
