import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PickerContext, PickerExtensionApi } from '../.pi/extensions/picker-inbox'

/**
 * The Pi extension lives outside src/ and test/, so nothing else covers it. It is
 * also the only thing that beats the heartbeat the panel relies on, which makes
 * it the one piece a unit test can still catch before it reaches a real session.
 *
 * The import is dynamic because the module reads PICKER_AGENT once, at load.
 */
type Handler = (event: unknown, ctx: PickerContext) => unknown

let register: (pi: PickerExtensionApi) => void
let handlers: Map<string, Handler>
let root: string

function fakePi(): PickerExtensionApi {
  return {
    on: (event, handler) => {
      handlers.set(event, handler)
    },
    sendMessage: vi.fn(),
    registerCommand: vi.fn(),
    registerShortcut: vi.fn(),
  }
}

const ctx = (): PickerContext => ({
  cwd: root,
  hasUI: false,
  ui: { setStatus: () => {}, notify: () => {} },
})

const stateDir = (): string => path.join(root, '.picker')
const heartbeat = (): string => path.join(stateDir(), 'listeners', 'pi.json')

beforeAll(async () => {
  delete process.env.PICKER_AGENT
  register = (await import('../.pi/extensions/picker-inbox')).default
})

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'picker-ext-'))
  fs.mkdirSync(stateDir(), { recursive: true })
  handlers = new Map()
})

afterEach(() => {
  // Any interval left running would keep the test process alive.
  handlers.get('session_shutdown')?.({}, ctx())
  fs.rmSync(root, { recursive: true, force: true })
})

describe('pi extension', () => {
  it('announces itself with a push heartbeat and withdraws it on shutdown', async () => {
    register(fakePi())
    await handlers.get('session_start')!({}, ctx())

    expect(fs.existsSync(heartbeat())).toBe(true)
    // mode: push is what makes the panel offer the push button at all.
    expect(JSON.parse(fs.readFileSync(heartbeat(), 'utf8'))).toMatchObject({
      agent: 'pi',
      mode: 'push',
      pid: process.pid,
    })
    expect(typeof JSON.parse(fs.readFileSync(heartbeat(), 'utf8')).at).toBe('number')

    await handlers.get('session_shutdown')!({}, ctx())
    expect(fs.existsSync(heartbeat())).toBe(false)
  })

  it('keeps the heartbeat fresh so it never looks like a dead agent', async () => {
    vi.useFakeTimers()
    try {
      register(fakePi())
      await handlers.get('session_start')!({}, ctx())
      const first = JSON.parse(fs.readFileSync(heartbeat(), 'utf8')).at

      await vi.advanceTimersByTimeAsync(2000)
      const second = JSON.parse(fs.readFileSync(heartbeat(), 'utf8')).at
      expect(second).toBeGreaterThan(first)
    } finally {
      vi.useRealTimers()
    }
  })

  it('injects a pick routed to this agent, once', async () => {
    fs.mkdirSync(path.join(stateDir(), 'inbox'), { recursive: true })
    fs.writeFileSync(path.join(stateDir(), 'inbox', 'pi.md'), '# Picker · seq 7\n\n- **src**: `a.vue:1:1`\n')
    register(fakePi())

    const first = (await handlers.get('before_agent_start')!({}, ctx())) as { message?: { content: string } }
    expect(first?.message?.content).toContain('a.vue:1:1')

    // Unchanged file: no repeat on the next prompt.
    expect(await handlers.get('before_agent_start')!({}, ctx())).toBeUndefined()
  })
})
