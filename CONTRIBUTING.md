# Contributing

Thanks for taking the time to contribute.

## Development

```bash
npm install
npm run typecheck   # tsc --noEmit
npm test            # vitest
npm run build       # tsup -> dist/
```

Node 20+ is required for development (Vite 7), even though the published
package supports Vite 5 and Node 18 at runtime.

## Trying it out

The `demo/` folder is a Vue 3 playground wired to the local package:

```bash
cd demo
npm install
npm run dev        # http://127.0.0.1:5173
```

Hold `Alt`, move the mouse, and `Alt`+click an element.

## Project layout

| Path | Purpose |
|---|---|
| `src/index.ts` | Vite plugin: transforms, client script, dev middleware |
| `src/transform.ts` | Inject `data-pick-ai` locators into Vue SFC / JSX |
| `src/client-code.ts` | The overlay UI injected into the page (plain JS string) |
| `src/state.ts` | `.pick-ai` record model + push control |
| `src/bridge.ts` | Reading picks from disk (used by the MCP server) |
| `src/mcp-server.ts` | MCP tools |
| `src/mcp.ts` | `pick-ai-mcp` stdio entry |
| `.pi/extensions/pick-ai-inbox.ts` | Example reader for the Pi agent |

## Guidelines

- Keep `src/client-code.ts` dependency-free and valid after the backtick-escape
  step (see the bottom of the file).
- Add a test for behavioural changes; tests live in `test/`.
- The overlay UI is themed through the `--pick-*` custom properties at the top
  of the `<style>` block in `src/client-code.ts`. Change colours there.
- Run `npm run typecheck && npm test && npm run build` before opening a PR.
