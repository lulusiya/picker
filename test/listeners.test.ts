import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { hasPushListener, LISTENER_STALE_MS, listenersDir, readListeners } from '../src/listeners'

let stateDir: string

beforeEach(() => {
  stateDir = fs.mkdtempSync(path.join(os.tmpdir(), 'picker-listeners-'))
})

afterEach(() => {
  fs.rmSync(stateDir, { recursive: true, force: true })
})

function beat(name: string, body: Record<string, unknown>): void {
  fs.mkdirSync(listenersDir(stateDir), { recursive: true })
  fs.writeFileSync(path.join(listenersDir(stateDir), `${name}.json`), JSON.stringify(body))
}

describe('readListeners', () => {
  it('returns nothing when no agent ever announced itself', () => {
    expect(readListeners(stateDir)).toEqual([])
  })

  it('reports a fresh heartbeat', () => {
    const now = 1_000_000
    beat('pi', { agent: 'pi', pid: 42, at: now })
    expect(readListeners(stateDir, now)).toEqual([{ agent: 'pi', pid: 42, at: now }])
  })

  it('drops a heartbeat that went stale', () => {
    const now = 1_000_000
    beat('pi', { agent: 'pi', at: now - LISTENER_STALE_MS - 1 })
    expect(readListeners(stateDir, now)).toEqual([])
  })

  it('keeps a heartbeat that is exactly at the stale boundary', () => {
    const now = 1_000_000
    beat('pi', { agent: 'pi', mode: 'push', at: now - LISTENER_STALE_MS })
    expect(readListeners(stateDir, now).map(listener => listener.agent)).toEqual(['pi'])
  })

  it('falls back to the file name when the body omits the agent', () => {
    beat('claude', { at: Date.now() })
    expect(readListeners(stateDir).map(listener => listener.agent)).toEqual(['claude'])
  })

  it('keeps a heartbeat that carries fields it does not know about', () => {
    const now = 1_000_000
    beat('a', { agent: 'a', mode: 'whatever', pid: 7, at: now })
    expect(readListeners(stateDir, now)).toEqual([{ agent: 'a', pid: 7, at: now }])
  })

  it('drops a heartbeat whose timestamp is not a number', () => {
    beat('b', { at: 'not a number' })
    expect(readListeners(stateDir)).toEqual([])
  })

  it('ignores malformed and non-json files', () => {
    beat('broken', {})
    fs.writeFileSync(path.join(listenersDir(stateDir), 'broken.json'), 'not json')
    fs.writeFileSync(path.join(listenersDir(stateDir), 'notes.txt'), 'ignore me')
    expect(readListeners(stateDir)).toEqual([])
  })

  it('sorts by agent so the panel order is stable', () => {
    const now = Date.now()
    for (const name of ['pi', 'codex', 'claude']) beat(name, { agent: name, at: now })
    expect(readListeners(stateDir, now).map(listener => listener.agent)).toEqual(['claude', 'codex', 'pi'])
  })
})

describe('hasPushListener', () => {
  it('is false with no heartbeat', () => {
    expect(hasPushListener(stateDir, 'pi')).toBe(false)
    expect(hasPushListener(stateDir, '')).toBe(false)
  })

  it('matches a named target only for that agent', () => {
    beat('pi', { agent: 'pi', at: Date.now() })
    expect(hasPushListener(stateDir, 'pi')).toBe(true)
    expect(hasPushListener(stateDir, 'codex')).toBe(false)
  })

  it('lets a broadcast go to any live listener', () => {
    beat('pi', { agent: 'pi', at: Date.now() })
    expect(hasPushListener(stateDir, '')).toBe(true)
  })

  it('ignores a stale listener', () => {
    beat('pi', { agent: 'pi', at: Date.now() - LISTENER_STALE_MS - 1 })
    expect(hasPushListener(stateDir, 'pi')).toBe(false)
  })
})
