// Smoke-tests the built entry points. `npm test` runs against src/ through
// vitest, so it can never catch a broken bundle - and a broken CJS bundle is
// easy to ship: esbuild compiles `import.meta.url` to undefined in CJS output.
import { createRequire } from 'node:module'

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

const failed = checks.filter(c => !c.ok)
for (const c of checks) {
  if (!c.ok) console.error(`FAIL ${c.label}\n  expected: ${c.expected}\n  actual:   ${c.actual}`)
}
if (failed.length) {
  console.error(`\n${failed.length} of ${checks.length} dist checks failed`)
  process.exit(1)
}
console.log(`dist ok: ${checks.length} checks passed (cjs + esm)`)
