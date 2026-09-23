/**
 * Pi extension: surface vite-plugin-picker picks inside the conversation.
 *
 * A file bridge is passive — writing `.picker/inbox/<agent>.md` does nothing
 * until a reader pulls it. This extension is that reader for Pi. For every
 * prompt it looks for the newest of:
 *
 *   <project>/.picker/inbox/<agent>.md   (picks routed to this agent)
 *   <project>/.picker/last-pick.md       (broadcast picks)
 *
 * and injects it as a message. Two delivery modes:
 *
 *   - pull : injected on your next prompt (default)
 *   - push : the browser's "推送" button (or /picker, or ctrl+alt+p) sets
 *            `.picker/push.json` `once`, injected immediately (one-shot)
 *
 * Set PICKER_AGENT to match a name from the plugin's `targets` option
 * (defaults to "pi"). Manual push: the /picker command or ctrl+alt+p.
 *
 * Reload with /reload (or restart Pi) after editing.
 */
import fs from 'node:fs'
import path from 'node:path'
import type { ExtensionAPI, ExtensionContext } from '@earendil-works/pi-coding-agent'

const AGENT = process.env.PICKER_AGENT?.trim() || 'pi'
const SKIP = new Set(['node_modules', 'dist', 'build', 'coverage'])
const MAX_DEPTH = 3
const POLL_MS = 800
const HEARTBEAT_MS = 2000
const DIR_CACHE_MS = 5000

/**
 * Picker discovers who can take an immediate push by watching heartbeats, so a
 * panel never offers a push button that would silently do nothing. This
 * extension is the only thing that beats today, because Pi is the only host that
 * exposes an injection channel (sendMessage with triggerTurn).
 */
function heartbeatFile(stateDir: string): string {
  return path.join(stateDir, 'listeners', `${AGENT}.json`)
}

function beat(stateDirs: string[]): void {
  for (const stateDir of stateDirs) {
    try {
      fs.mkdirSync(path.dirname(heartbeatFile(stateDir)), { recursive: true })
      fs.writeFileSync(
        heartbeatFile(stateDir),
        JSON.stringify({ agent: AGENT, mode: 'push', pid: process.pid, at: Date.now() }),
      )
    } catch {
      // A read-only or missing .picker is not worth breaking the session over.
    }
  }
}

function stopBeating(stateDirs: string[]): void {
  for (const stateDir of stateDirs) {
    try {
      fs.rmSync(heartbeatFile(stateDir), { force: true })
    } catch {
      // Already gone.
    }
  }
}

interface Candidate {
  file: string
  stateDir: string
  mtimeMs: number
}

/** Finds every `.picker` directory near the project root (bounded search). */
function findStateDirs(root: string): string[] {
  const found: string[] = []
  const queue: Array<{ dir: string; depth: number }> = [{ dir: root, depth: 0 }]
  while (queue.length) {
    const { dir, depth } = queue.shift()!
    if (fs.existsSync(path.join(dir, '.picker'))) found.push(path.join(dir, '.picker'))
    if (depth >= MAX_DEPTH) continue
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

function readPush(stateDir: string): { once: number; target: string } {
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

function latestCandidate(stateDirs: string[]): Candidate | null {
  let best: Candidate | null = null
  for (const stateDir of stateDirs) {
    const files = [path.join(stateDir, 'inbox', `${AGENT}.md`), path.join(stateDir, 'last-pick.md')]
    for (const file of files) {
      try {
        const stat = fs.statSync(file)
        if (stat.isFile() && (!best || stat.mtimeMs > best.mtimeMs)) best = { file, stateDir, mtimeMs: stat.mtimeMs }
      } catch {
        // Not written yet.
      }
    }
  }
  return best
}

function readCandidate(file: string): string {
  try {
    return fs.readFileSync(file, 'utf8')
  } catch {
    return ''
  }
}

function keyOf(candidate: Candidate): string {
  return `${candidate.file}:${candidate.mtimeMs}`
}

function compose(file: string, body: string): string {
  const label = path.basename(path.dirname(file)) === 'inbox' ? path.basename(file) : 'last-pick.md'
  return `🖱️ Picker 选取（agent=${AGENT}，来源=${label}）\n\n${body}`
}

export default function (pi: ExtensionAPI) {
  let currentCtx: ExtensionContext | null = null
  let lastInjected = ''
  let lastOnce = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let beatTimer: ReturnType<typeof setInterval> | null = null
  let dirCache: { root: string; dirs: string[]; at: number } | null = null

  const getStateDirs = (root: string): string[] => {
    if (dirCache && dirCache.root === root && Date.now() - dirCache.at < DIR_CACHE_MS) return dirCache.dirs
    const dirs = findStateDirs(root)
    dirCache = { root, dirs, at: Date.now() }
    return dirs
  }

  const showStatus = (ctx: ExtensionContext): void => {
    if (!ctx.hasUI) return
    const dirs = getStateDirs(ctx.cwd)
    ctx.ui.setStatus('picker', dirs.length ? `Picker → ${AGENT}` : `Picker: 未发现 .picker`)
  }

  const deliver = (ctx: ExtensionContext, candidate: Candidate, note: string): void => {
    const content = readCandidate(candidate.file)
    if (!content) return
    lastInjected = keyOf(candidate)
    if (ctx.hasUI) ctx.ui.notify(note, 'info')
    pi.sendMessage(
      { customType: 'picker', content: compose(candidate.file, content), display: true },
      { deliverAs: 'followUp', triggerTurn: true },
    )
  }

  const manualPush = (ctx: ExtensionContext): void => {
    showStatus(ctx)
    const candidate = latestCandidate(getStateDirs(ctx.cwd))
    if (!candidate) {
      if (ctx.hasUI) ctx.ui.notify('没有找到 .picker 记录（先在浏览器里 Alt+点击选一个元素）', 'warn')
      return
    }
    deliver(ctx, candidate, `已推送 ${path.basename(candidate.file)}`)
  }

  pi.on('session_start', async (_event, ctx) => {
    currentCtx = ctx
    showStatus(ctx)
    if (!beatTimer) {
      beat(getStateDirs(ctx.cwd))
      beatTimer = setInterval(() => {
        if (currentCtx) beat(getStateDirs(currentCtx.cwd))
      }, HEARTBEAT_MS)
    }
    if (timer) return
    timer = setInterval(() => {
      if (!currentCtx) return
      const candidate = latestCandidate(getStateDirs(currentCtx.cwd))
      if (!candidate) return
      const control = readPush(candidate.stateDir)
      if (control.once <= lastOnce) return
      lastOnce = control.once
      // A push aimed at another agent is consumed but not delivered here.
      if (control.target && control.target !== AGENT) return
      deliver(currentCtx, candidate, 'Picker 推送')
    }, POLL_MS)
  })

  pi.on('before_agent_start', async (_event, ctx) => {
    currentCtx = ctx
    showStatus(ctx)
    const candidate = latestCandidate(getStateDirs(ctx.cwd))
    if (!candidate) return
    const key = keyOf(candidate)
    if (key === lastInjected) return
    const body = readCandidate(candidate.file)
    if (!body) return
    lastInjected = key
    if (ctx.hasUI) ctx.ui.notify(`Picker 已注入 ${path.basename(candidate.file)}`, 'info')
    return {
      message: { customType: 'picker', content: compose(candidate.file, body), display: true },
    }
  })

  pi.on('session_shutdown', async () => {
    if (beatTimer) {
      clearInterval(beatTimer)
      beatTimer = null
      if (currentCtx) stopBeating(getStateDirs(currentCtx.cwd))
    }
    if (!timer) return
    clearInterval(timer)
    timer = null
  })

  pi.registerCommand('picker', {
    description: '推送最新的 Picker 选取到会话',
    handler: async (_args, ctx) => manualPush(ctx),
  })

  pi.registerShortcut('ctrl+alt+p', {
    description: 'Picker: 推送最新选取',
    handler: async (ctx) => manualPush(ctx),
  })
}
