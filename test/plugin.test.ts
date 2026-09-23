import { describe, expect, it } from 'vitest'
import { promises as fsp } from 'node:fs'
import { createServer as createHttpServer } from 'node:http'
import type { AddressInfo } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { createServer } from 'vite'
import picker, { createClientScript } from '../src/index'

describe('Vite plugin HTML injection', () => {
  it('injects the runtime config into the client script', () => {
    expect(createClientScript()).toContain('globalThis.__PICKER_CONFIG__ = {"targets":[]}')
    expect(createClientScript({ targets: ['codex', 'bad name', 'codex'] })).toContain('"targets":["codex"]')
  })

  it('injects the client through a same-origin HTTP module path', () => {
    const plugin = picker()
    const hook = plugin.transformIndexHtml
    expect(typeof hook).toBe('function')

    const tags = (hook as unknown as () => Array<{ attrs: Record<string, string> }>)()
    expect(tags[0].attrs).toEqual({
      type: 'module',
      src: '/__picker/client.js',
    })
    expect(JSON.stringify(tags)).not.toContain('virtual:')
  })

  it('keeps the same-origin URL in Vite final HTML', async () => {
    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [picker({ stateDir: false })],
    })
    try {
      const html = await server.transformIndexHtml('/', '<html><body></body></html>')
      expect(html).toContain('src="/__picker/client.js"')
      expect(html).not.toContain('virtual:picker/client')
    } finally {
      await server.close()
    }
  })

  it('serves the client module with the runtime config', async () => {
    const server = await createServer({
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [picker({ targets: ['codex'], stateDir: false })],
    })
    const httpServer = createHttpServer(server.middlewares)
    await new Promise<void>(resolve => httpServer.listen(0, resolve))
    try {
      const { port } = httpServer.address() as AddressInfo
      const client = await fetch(`http://127.0.0.1:${port}/__picker/client.js`)
      expect(client.status).toBe(200)
      expect(await client.text()).toContain('"targets":["codex"]')
    } finally {
      await new Promise<void>(resolve => httpServer.close(() => resolve()))
      await server.close()
    }
  })

  it('writes picked elements to the state directory for agents', async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'picker-'))
    const plugin = picker({ targets: ['codex'] })
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [plugin],
    })
    const httpServer = createHttpServer(server.middlewares)
    await new Promise<void>(resolve => httpServer.listen(0, resolve))
    try {
      const source = '<template>\n  <button class="cta">Go</button>\n</template>\n'
      const transform = plugin.transform as unknown as (
        code: string,
        id: string,
      ) => { code: string } | null
      const output = transform.call(plugin, source, path.join(root, 'App.vue'))
      const id = /data-picker="([^"]+)"/.exec(output!.code)![1]

      const { port } = httpServer.address() as AddressInfo
      const post = (target: string, instruction: string) =>
        fetch(`http://127.0.0.1:${port}/__picker/record`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id, kind: 'prompt', chain: 'App > Child', instruction, target }),
        })

      const targeted = await post('codex', 'make it blue')
      expect(targeted.status).toBe(204)

      const inbox = await fsp.readFile(path.join(root, '.picker', 'inbox', 'codex.md'), 'utf8')
      expect(inbox).toContain('- **target**: codex')
      expect(inbox).toContain('make it blue')
      // A targeted pick must not leak into the broadcast snapshot.
      await expect(fsp.readFile(path.join(root, '.picker', 'last-pick.md'), 'utf8')).rejects.toThrow()

      const broadcast = await post('', 'for everyone')
      expect(broadcast.status).toBe(204)
      const markdown = await fsp.readFile(path.join(root, '.picker', 'last-pick.md'), 'utf8')
      expect(markdown).toContain('for everyone')
      expect(markdown).toContain('- **range**: App > Child')
      expect(markdown).toContain('- **target**: 全部')

      const lines = (await fsp.readFile(path.join(root, '.picker', 'picks.jsonl'), 'utf8')).trim().split('\n')
      expect(JSON.parse(lines[0])).toMatchObject({ instruction: 'make it blue', targets: ['codex'], seq: 1 })
      expect(JSON.parse(lines[1])).toMatchObject({ instruction: 'for everyone', targets: [], seq: 2 })

      const pushUrl = `http://127.0.0.1:${port}/__picker/push`
      expect(await (await fetch(pushUrl)).json()).toEqual({ once: 0, target: '' })

      const once = await fetch(pushUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ once: true, target: 'codex' }),
      })
      const onceBody = (await once.json()) as { once: number; target: string }
      expect(onceBody.once).toBeGreaterThan(0)
      expect(onceBody.target).toBe('codex')

      // A target that is not configured is downgraded to a broadcast request.
      const unknown = await fetch(pushUrl, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ once: true, target: 'ghost' }),
      })
      expect(((await unknown.json()) as { target: string }).target).toBe('')
    } finally {
      await new Promise<void>(resolve => httpServer.close(() => resolve()))
      await server.close()
      await fsp.rm(root, { recursive: true, force: true })
    }
  })

  it('evicts stale source records when a file is edited', async () => {
    const root = await fsp.mkdtemp(path.join(os.tmpdir(), 'picker-hmr-'))
    const plugin = picker({ stateDir: false })
    const server = await createServer({
      root,
      configFile: false,
      logLevel: 'silent',
      server: { middlewareMode: true },
      plugins: [plugin],
    })
    const httpServer = createHttpServer(server.middlewares)
    await new Promise<void>(resolve => httpServer.listen(0, resolve))
    try {
      const file = path.join(root, 'App.vue')
      const transform = plugin.transform as unknown as (code: string, id: string) => { code: string } | null
      const output = transform.call(plugin, '<template>\n  <button>Go</button>\n</template>\n', file)
      const id = /data-picker="([^"]+)"/.exec(output!.code)![1]

      const { port } = httpServer.address() as AddressInfo
      const lookup = () => fetch(`http://127.0.0.1:${port}/__picker/source?id=${encodeURIComponent(id)}`)
      expect((await lookup()).status).toBe(200)

      const handleHotUpdate = plugin.handleHotUpdate as unknown as (ctx: { file: string }) => void
      handleHotUpdate.call(plugin, { file })
      expect((await lookup()).status).toBe(404)
    } finally {
      await new Promise<void>(resolve => httpServer.close(() => resolve()))
      await server.close()
      await fsp.rm(root, { recursive: true, force: true })
    }
  })
})
