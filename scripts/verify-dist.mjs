// Smoke-tests the built entry points. `npm test` runs against src/ through
// vitest, so it can never catch a broken bundle - and a broken CJS bundle is
// easy to ship: esbuild compiles `import.meta.url` to undefined in CJS output.
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const vueSfc = '<template>\n  <main class="card">\n    <button>Go</button>\n  </main>\n</template>\n'
const jsx = 'export function Card() {\n  return <div className="card"><span>Hi</span></div>\n}'

const checks = []
function check(label, actual, expected) {
  const ok = actual === expected
  checks.push({ label, ok, actual, expected })
}

/** Both formats must load, instrument and honour the null contract. */
async function verify(label, mod) {
  const vue = mod.instrumentVueSfc(vueSfc, '/app/src/App.vue')
  check(`${label}: vue records`, vue.records.size, 2)
  check(`${label}: vue component`, [...vue.records.values()][0].component, 'App')
  check(`${label}: vue attribute`, vue.code.includes('data-picker="'), true)

  const tsx = mod.instrumentJsx(jsx, '/app/src/Card.tsx')
  check(`${label}: jsx records`, tsx.records.size, 2)
  check(`${label}: jsx component`, [...tsx.records.values()][0].component, 'Card')

  check(`${label}: astro -> null`, mod.instrumentVueSfc('---\nconst a = 1\n---\n', 'P.astro'), null)
  check(`${label}: svelte -> null`, mod.instrumentJsx('<script>let n = 0</script>\n<b>{n}</b>', 'A.svelte'), null)

  const createPlugin = typeof mod.default === 'function' ? mod.default : mod.default.default
  const plugin = createPlugin({ stateDir: false })
  check(`${label}: plugin name`, plugin.name, 'vite-plugin-picker')
  check(`${label}: plugin apply`, plugin.apply, 'serve')
  const tag = plugin.transformIndexHtml()[0]
  check(`${label}: injected src`, tag.attrs.src, '/__picker/client.js')
  check(`${label}: hooks`, ['configureServer', 'handleHotUpdate', 'transform'].every(h => typeof plugin[h] === 'function'), true)
}

const cjs = createRequire(import.meta.url)('../dist/index.cjs')
await verify('cjs', cjs)
await verify('esm', await import(new URL('../dist/index.js', import.meta.url).href))

// The hook is a command line entry point, so exercise the real process: the
// contract that matters is its stdout and that it never exits non-zero.
function runHook(args, options = {}) {
  const hook = fileURLToPath(new URL('../dist/hook.js', import.meta.url))
  const stdout = execFileSync(process.execPath, [hook, ...args], {
    encoding: 'utf8',
    input: '{"hook_event_name":"UserPromptSubmit"}',
    ...options,
  })
  return stdout
}

const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), 'picker-dist-'))
try {
  const stateDir = path.join(sandbox, '.picker')
  fs.mkdirSync(path.join(stateDir, 'inbox'), { recursive: true })
  const pin = (file, body, seconds) => {
    fs.writeFileSync(file, body)
    fs.utimesSync(file, seconds, seconds)
  }
  pin(path.join(stateDir, 'last-pick.md'), '# Picker · seq 1\n\n- **src**: `src/App.vue:1:1`\n', 1000)

  // claude reads its stdout as context, so plain text is the right shape.
  check('hook: text format', runHook(['--agent', 'claude', '--root', sandbox]).startsWith('🖱️'), true)
  check('hook: silent on the second run', runHook(['--agent', 'claude', '--root', sandbox]), '')

  // codex ignores plain stdout here and needs the json envelope.
  const parsed = JSON.parse(runHook(['--agent', 'codex', '--format', 'codex', '--root', sandbox]))
  check('hook: codex envelope', parsed.hookSpecificOutput.hookEventName, 'UserPromptSubmit')
  check('hook: context carries the pick', parsed.hookSpecificOutput.additionalContext.includes('src/App.vue:1:1'), true)
  check('hook: silent on the second run (codex)', runHook(['--agent', 'codex', '--format', 'codex', '--root', sandbox]), '')
  check('hook: --force emits again', runHook(['--agent', 'codex', '--force', '--root', sandbox]).includes('Picker'), true)

  // a routed pick outranks the broadcast file.
  pin(path.join(stateDir, 'inbox', 'codex.md'), '# Picker · seq 2\n\n- **src**: `src/Targeted.vue:9:9`\n', 2000)
  check('hook: prefers the agent inbox', runHook(['--agent', 'codex', '--root', sandbox]).includes('Targeted.vue'), true)
  check('hook: claude is unaffected by codex inbox', runHook(['--agent', 'claude', '--root', sandbox]), '')

  check('hook: no state is silent', runHook(['--agent', 'codex', '--root', path.join(sandbox, 'missing')]), '')
} finally {
  fs.rmSync(sandbox, { recursive: true, force: true })
}

const failed = checks.filter(c => !c.ok)
for (const c of checks) {
  if (!c.ok) console.error(`FAIL ${c.label}\n  expected: ${c.expected}\n  actual:   ${c.actual}`)
}
if (failed.length) {
  console.error(`\n${failed.length} of ${checks.length} dist checks failed`)
  process.exit(1)
}
console.log(`dist ok: ${checks.length} checks passed (cjs + esm)`)
