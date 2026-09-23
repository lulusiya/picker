import fs from 'node:fs'
import path from 'node:path'

/**
 * Delivery capability is discovered, not declared.
 *
 * "Push" means inject into a session that is running right now, which is only
 * possible when the host exposes an injection channel. A static `targets` list
 * cannot tell the panel who is actually connected, so a push-capable agent
 * refreshes a heartbeat while it runs and the panel renders from that.
 *
 * The payoff is that the panel can no longer offer a push button that silently
 * does nothing: if no heartbeat is fresh, there is no one to push to.
 *
 * A heartbeat therefore *means* "I can take a push right now". An agent that is
 * only read on its next prompt - a prompt hook, for example - must not beat one,
 * because that would advertise an injection that cannot happen.
 */
export interface Listener {
  agent: string
  pid?: number
  /** Epoch ms of the last heartbeat. */
  at: number
}

/** Five missed beats at the 2s interval the Pi extension uses. */
export const LISTENER_STALE_MS = 10_000

export function listenersDir(stateDir: string): string {
  return path.join(stateDir, 'listeners')
}

/** Heartbeats that are still fresh. A stale file means the agent is gone. */
export function readListeners(stateDir: string, now = Date.now()): Listener[] {
  let names: string[]
  try {
    names = fs.readdirSync(listenersDir(stateDir))
  } catch {
    return []
  }

  const fresh: Listener[] = []
  for (const name of names) {
    if (!name.endsWith('.json')) continue
    try {
      const value = JSON.parse(fs.readFileSync(path.join(listenersDir(stateDir), name), 'utf8')) as Partial<Listener>
      const at = typeof value.at === 'number' ? value.at : 0
      if (now - at > LISTENER_STALE_MS) continue
      const agent = typeof value.agent === 'string' && value.agent ? value.agent : name.replace(/\.json$/, '')
      fresh.push({
        agent,
        pid: typeof value.pid === 'number' ? value.pid : undefined,
        at,
      })
    } catch {
      // A half-written or malformed heartbeat is not worth reporting.
    }
  }
  return fresh.sort((a, b) => a.agent.localeCompare(b.agent))
}

/**
 * True when someone can take an immediate push. An empty `agent` is a broadcast,
 * which any live push listener accepts; a named one only matches itself.
 */
export function hasPushListener(stateDir: string, agent = '', now = Date.now()): boolean {
  return readListeners(stateDir, now).some(listener => agent === '' || listener.agent === agent)
}
