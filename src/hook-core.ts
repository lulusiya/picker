import fs from 'node:fs'
import path from 'node:path'
import { discoverStateDirs, latestSnapshot, type Snapshot } from './bridge'

/**
 * Delivery logic shared by the `picker-hook` CLI. Kept free of process and
 * stdout side effects so it can be tested directly.
 *
 * A file bridge is passive: writing `.picker/inbox/<agent>.md` does nothing
 * until a reader pulls it. An agent-side hook is that reader. Hooks fire once
 * per prompt, so the same pick must not be injected on every turn - a state file
 * remembers the last snapshot that was handed over.
 */

export type HookFormat = 'text' | 'codex'

export interface HookOptions {
  /** Agent name matching the plugin's `targets` option. */
  agent: string
  /** Where to start looking for `.picker`. */
  root: string
  format: HookFormat
  /** Ignore the delivered state and emit again. */
  force?: boolean
}

interface HookState {
  /** `<file>:<mtimeMs>` of the last delivered snapshot. */
  key: string
  /** Last `push.json` value consumed, so an explicit push re-arms delivery. */
  once: number
}

export interface HookResult {
  payload: string
  /** Identifies the snapshot, for logging and tests. */
  snapshot: Snapshot
  stateFile: string
  state: HookState
}

/** Prefixes the snapshot so the agent can tell a pick from ordinary context. */
export function composePayload(agent: string, file: string, body: string): string {
  const label = path.basename(path.dirname(file)) === 'inbox' ? path.basename(file) : 'last-pick.md'
  const who = agent || 'agent'
  return `🖱️ Picker 选取（agent=${who}，来源=${label}）\n\n${body.trimEnd()}\n`
}

/** Wraps the block in whatever shape the host agent expects on stdout. */
export function renderPayload(format: HookFormat, agent: string, file: string, body: string): string {
  const context = composePayload(agent, file, body)
  if (format === 'codex') {
    // Codex ignores plain stdout on this event; it only reads JSON.
    return `${JSON.stringify({
      hookSpecificOutput: { hookEventName: 'UserPromptSubmit', additionalContext: context },
    })}\n`
  }
  // Claude Code adds stdout to the model context for UserPromptSubmit.
  return context
}

export function snapshotKey(snapshot: Snapshot): string {
  return `${snapshot.file}:${snapshot.mtimeMs}`
}

/** The browser's „推送" button bumps `push.json` so a pick can be re-sent. */
export function readPushControl(stateDir: string): { once: number; target: string } {
  try {
    const value = JSON.parse(fs.readFileSync(path.join(stateDir, 'push.json'), 'utf8')) as {
      once?: number
      target?: string
    }
    return {
      once: typeof value.once === 'number' && value.once > 0 ? value.once : 0,
      target: typeof value.target === 'string' ? value.target : '',
    }
  } catch {
    return { once: 0, target: '' }
  }
}

function readBody(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function stateFilePath(stateDir: string, agent: string): string {
  return path.join(stateDir, '.hook', `${agent || 'agent'}.json`)
}

function readState(file: string): HookState {
  try {
    const value = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<HookState>
    return {
      key: typeof value.key === 'string' ? value.key : '',
      once: typeof value.once === 'number' && value.once > 0 ? value.once : 0,
    }
  } catch {
    return { key: '', once: 0 }
  }
}

function writeState(file: string, state: HookState): void {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, `${JSON.stringify(state)}\n`)
}

/**
 * Returns what the hook should print, or null when there is nothing new.
 *
 * Delivery happens when the snapshot changed since last time, or when the
 * browser asked for a push aimed at this agent (or at everyone) since then.
 */
export function collect(options: HookOptions): HookResult | null {
  const stateDirs = discoverStateDirs(options.root)
  if (!stateDirs.length) return null

  const snapshot = latestSnapshot(stateDirs, options.agent)
  if (!snapshot) return null

  const body = readBody(snapshot.file)
  if (!body.trim()) return null

  const stateFile = stateFilePath(snapshot.stateDir, options.agent)
  const previous = readState(stateFile)
  const key = snapshotKey(snapshot)
  const control = readPushControl(snapshot.stateDir)

  const changed = key !== previous.key
  const pushed =
    control.once > previous.once && (control.target === '' || control.target === options.agent)
  if (!options.force && !changed && !pushed) return null

  const state: HookState = { key, once: Math.max(control.once, previous.once) }
  writeState(stateFile, state)

  return {
    payload: renderPayload(options.format, options.agent, snapshot.file, body),
    snapshot,
    stateFile,
    state,
  }
}
