import fs from 'node:fs'
import type { IncomingMessage } from 'node:http'
import path from 'node:path'
import type { Plugin, ViteDevServer } from 'vite'
import { clientCode } from './client-code'
import { buildPickEntry, defaultPushControl, normalizeTargets, parseEntries, parsePushControl, renderLastPick, type PickEntry, type RecordPayload } from './state'
import { hasPushListener, readListeners } from './listeners'
import { instrumentJsx, instrumentVueSfc, type SourceRecord } from './transform'

export interface PickerOptions {
  /** Files to transform. Defaults to JSX, TSX and Vue SFC files. */
  include?: RegExp
  /**
   * Directory, relative to the Vite root, where picked elements are written for
   * file-based agent consumption (`picks.jsonl` + `last-pick.md`). Set to false
   * to disable. Defaults to `.picker`.
   */
  stateDir?: string | false
  /**
   * Agent names offered as routing targets in the pick panel. A targeted pick is
   * written to `<stateDir>/inbox/<name>.md`; broadcast picks go to
   * `<stateDir>/last-pick.md`. Names are sanitised to `[a-z0-9_-]`. Defaults to
   * none (broadcast only).
   */
  targets?: string[]
}

const CLIENT_PATH = '/__picker/client.js'

/** Builds the client module with the runtime config the browser needs. */
export function createClientScript(options: PickerOptions = {}): string {
  const config = {
    targets: normalizeTargets(options.targets),
  }
  return 'globalThis.__PICKER_CONFIG__ = ' + JSON.stringify(config) + '\n' + clientCode
}

/** Collects a request body as UTF-8, with a hard size cap. */
function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      if (size < 200_000) { chunks.push(chunk); size += chunk.length }
    })
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** Mounts the file-based bridge that lets AI agents read picked elements. */
function mountStateBridge(
  server: ViteDevServer,
  records: Map<string, SourceRecord>,
  stateDir: string,
  agentTargets: string[],
): void {
  const logFile = path.join(stateDir, 'picks.jsonl')
  const lastFile = path.join(stateDir, 'last-pick.md')
  const pushFile = path.join(stateDir, 'push.json')
  let seq = 0
  try {
    fs.mkdirSync(stateDir, { recursive: true })
    seq = parseEntries(fs.readFileSync(logFile, 'utf8')).reduce((max, entry) => Math.max(max, entry.seq ?? 0), 0)
  } catch { /* first run: no state yet */ }

  server.middlewares.use('/__picker/record', async (req, res) => {
    if (req.method !== 'POST') { res.statusCode = 405; res.end(); return }
    try {
      const payload = JSON.parse((await readBody(req)) || '{}') as RecordPayload
      const record = payload.id ? records.get(payload.id) : undefined
      if (!record || !payload.id) {
        res.statusCode = 404
        res.end(JSON.stringify({ error: 'Source not found' }))
        return
      }
      const target = payload.target && agentTargets.includes(payload.target) ? payload.target : undefined
      const entry = buildPickEntry(record, payload, payload.id, ++seq, Date.now(), target)
      fs.mkdirSync(stateDir, { recursive: true })
      fs.appendFileSync(logFile, `${JSON.stringify(entry)}\n`)
      const snapshot = renderLastPick(entry)
      if (target) {
        const inboxDir = path.join(stateDir, 'inbox')
        fs.mkdirSync(inboxDir, { recursive: true })
        fs.writeFileSync(path.join(inboxDir, `${target}.md`), snapshot)
      } else {
        fs.writeFileSync(lastFile, snapshot)
      }
      res.statusCode = 204
      res.end()
    } catch {
      res.statusCode = 400
      res.end(JSON.stringify({ error: 'Invalid request' }))
    }
  })

  server.middlewares.use('/__picker/push', async (req, res) => {
    res.setHeader('content-type', 'application/json; charset=utf-8')
    let control = defaultPushControl()
    try { control = parsePushControl(fs.readFileSync(pushFile, 'utf8')) } catch { /* no control yet */ }
    if (req.method === 'POST') {
      try {
        const patch = JSON.parse((await readBody(req)) || '{}') as { once?: boolean; target?: string }
        if (patch.once === true) {
          const target = patch.target && agentTargets.includes(patch.target) ? patch.target : ''
          // Push means "inject into a running session". With nobody connected there
          // is nothing to inject into, so refuse instead of writing a timestamp
          // nobody will read and letting the caller report success.
          if (!hasPushListener(stateDir, target)) {
            res.statusCode = 409
            res.end(JSON.stringify({ error: 'No agent is listening', target, live: readListeners(stateDir).map((l) => l.agent) }))
            return
          }
          control = { once: Date.now(), target }
        }
        fs.mkdirSync(stateDir, { recursive: true })
        fs.writeFileSync(pushFile, `${JSON.stringify(control)}\n`)
      } catch {
        res.statusCode = 400
        res.end(JSON.stringify({ error: 'Invalid request' }))
        return
      }
    }
    res.end(JSON.stringify(control))
  })

  server.middlewares.use('/__picker/picks', (_req, res) => {
    res.setHeader('content-type', 'application/json; charset=utf-8')
    let entries: PickEntry[] = []
    try { entries = parseEntries(fs.readFileSync(logFile, 'utf8')) } catch { /* no log yet */ }
    res.end(JSON.stringify({ seq, entries }))
  })

  // Who can take an immediate push right now. The panel renders its routing row
  // and enables the push action from this, so a dead agent can never be offered.
  server.middlewares.use('/__picker/listeners', (_req, res) => {
    res.setHeader('content-type', 'application/json; charset=utf-8')
    res.setHeader('cache-control', 'no-store')
    res.end(JSON.stringify({ listeners: readListeners(stateDir) }))
  })
}

export default function picker(options: PickerOptions = {}): Plugin {
  const records = new Map<string, SourceRecord>()
  const include = options.include ?? /\.(?:[jt]sx|vue)$/
  const script = createClientScript(options)
  const stateDirName = options.stateDir === false ? null : options.stateDir ?? '.picker'

  return {
    name: 'vite-plugin-picker',
    apply: 'serve',
    enforce: 'pre',
    transformIndexHtml() {
      return [{
        tag: 'script',
        attrs: { type: 'module', src: CLIENT_PATH },
        injectTo: 'body',
      }]
    },
    transform(code, id) {
      const file = id.split('?')[0]
      include.lastIndex = 0
      if (!include.test(file) || /[\\/]node_modules[\\/]/.test(file)) return null
      let result
      try {
        result = file.endsWith('.vue')
          ? instrumentVueSfc(code, path.resolve(file))
          : instrumentJsx(code, path.resolve(file))
      } catch { return null }
      if (!result) return null
      for (const [key, value] of result.records) records.set(key, value)
      return { code: result.code, map: result.map }
    },
    handleHotUpdate(ctx) {
      // Edited files shift line numbers, so their old locators are stale.
      const file = path.resolve(ctx.file)
      for (const [key, record] of records) {
        if (path.resolve(record.file) === file) records.delete(key)
      }
    },
    configureServer(server) {
      server.middlewares.use(CLIENT_PATH, (_req, res) => {
        res.statusCode = 200
        res.setHeader('content-type', 'text/javascript; charset=utf-8')
        res.setHeader('cache-control', 'no-store')
        res.end(script)
      })
      server.middlewares.use('/__picker/source', (req, res) => {
        const url = new URL(req.url ?? '/', 'http://localhost')
        const record = records.get(url.searchParams.get('id') ?? '')
        res.setHeader('content-type', 'application/json; charset=utf-8')
        if (!record) { res.statusCode = 404; res.end(JSON.stringify({ error: 'Source not found' })); return }
        res.end(JSON.stringify(record))
      })
      if (stateDirName) mountStateBridge(server, records, path.resolve(server.config.root, stateDirName), normalizeTargets(options.targets))
    },
  }
}

export { instrumentJsx, instrumentVueSfc }
