# vite-plugin-picker

[![CI](https://github.com/lulusiya/picker/actions/workflows/ci.yml/badge.svg)](https://github.com/lulusiya/picker/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/vite-plugin-picker.svg)](https://www.npmjs.com/package/vite-plugin-picker)
[![node](https://img.shields.io/node/v/vite-plugin-picker.svg)](https://www.npmjs.com/package/vite-plugin-picker)
[![license](https://img.shields.io/github/license/lulusiya/picker.svg)](./LICENSE)

**English** | [简体中文](./README.md)

Hold `Alt` and move the mouse over a page in a Vue 3, React or Preact Vite app
to highlight the DOM element underneath. Hold `Alt` and click to see the
absolute source path, line/column, component name and component chain — and get
a prompt you can hand straight to an AI agent.

![Hold `Alt` to highlight an element, `Alt`-click to get its source location and component chain](./docs/demo.gif)

## Install

```bash
npm install -D vite-plugin-picker
```

## Usage

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import picker from 'vite-plugin-picker'

export default defineConfig({
  plugins: [picker(), react()],
})
```

For Vue 3:

```ts
// vite.config.ts
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import picker from 'vite-plugin-picker'

export default defineConfig({
  plugins: [picker(), vue()],
})
```

The plugin only runs in the Vite dev server and never enters a production build.
It supports Vue 3 `.vue` SFCs, `.jsx` and `.tsx` by default.

```ts
picker({
  include: /\.(?:vue|[jt]sx)$/,
  stateDir: '.picker', // where picks are written; false disables; default '.picker'
  targets: ['pi', 'codex'], // options in the "Send to" row; default [] (broadcast only)
})
```

## How it works

1. Start the Vite dev server. A green "Picker enabled" badge in the bottom-right
   corner means the plugin is running.
2. Hold `Alt` and move the mouse to highlight elements.
3. Keep `Alt` held and click an element.
4. Type what you want changed in the card below the element and click **Copy** to
   put the prompt plus `src` (with line/column) and `range` (the component chain)
   on the clipboard.
5. **Stash** saves the element and instruction into the stash tray; you can keep
   picking other elements. The tray supports checkboxes, batch copy/delete and
   editing each instruction in place.
6. **Push** (or press `Enter` in the textarea; `Shift+Enter` for a newline) sends
   the current pick and instruction to the selected target's session immediately.

## Handing it to an AI (file bridge)

Besides the clipboard, the plugin writes the picked element into `.picker/` at
your project root (configurable with `stateDir`):

- `.picker/picks.jsonl` — append-only log, one JSON per line, with an incrementing
  `seq`, `file`/`line`/`column`, component `chain`, the element `range`, `targets`,
  and (when an instruction was written) `instruction` and the composed `prompt`.
- `.picker/last-pick.md` — the readable snapshot updated for **broadcast** picks.
- `.picker/inbox/<agent>.md` — the readable snapshot updated for targeted picks.
- `.picker/push.json` — the latest push request (`once` timestamp, `target`).

Absolute paths are only resolved on the local Vite server by short id; the browser
never receives the full path. Add `.picker/` to your `.gitignore` (already done in
this repo).

> ⚠️ Writing a file does nothing on its own — **it does not enter any chat**. A
> reader has to pull it.

## Making an agent read it

The file bridge is passive, so the agent side has to read it. There are two ways:

**1. Manual (zero setup, any agent)** — just say in the chat:

> Read `.picker/inbox/pi.md` (or `.picker/last-pick.md`) and make the change it asks for.

**2. Automatic injection (recommended)** — install a hook that reads it when you
submit a prompt. This repo ships one for Pi: `.pi/extensions/picker-inbox.ts`. It
listens to `before_agent_start` and injects the newest inbox/broadcast snapshot,
without repeating while the file is unchanged. Run `/reload` (or restart Pi) to
load it.

It supports two delivery modes:

| Mode | Trigger | Behaviour |
|---|---|---|
| Pull | You send Pi a message | Inject the newest pick (default) |
| Push | Browser **Push** / `Enter`, or Pi `ctrl+alt+p` / `/picker` | Inject the current pick immediately |

Other agents work the same way — for example Claude Code via a `UserPromptSubmit`
hook, or Codex via `AGENTS.md` telling it to read `.picker/inbox/codex.md` before
starting. Or just use the MCP server below.

## Multi-agent routing

There is no link between the browser and your terminals, so the plugin cannot
guess which agent a pick is for. Instead you pick the target explicitly: once
`targets` is configured, the panel shows a "Send to" row, and the pick is written
to that agent's inbox.

```ts
picker({ targets: ['pi', 'codex'] }) // panel shows an "All" option plus [pi] [codex]
```

- "All" (default) → writes only `.picker/last-pick.md`.
- An agent → writes only `.picker/inbox/<name>.md` (it never pollutes the
  broadcast snapshot).

Each agent is told to read its own inbox, for example:

> You are codex. When needed, read `.picker/inbox/codex.md` and make the change it asks for.

```
.picker/
├─ picks.jsonl        # full log (each line has targets)
├─ last-pick.md       # broadcast ("All")
├─ push.json          # push request (once / target)
└─ inbox/
   ├─ pi.md           # latest pick for pi
   └─ codex.md        # latest pick for codex
```

The inbox is "latest wins": two unread picks for the same agent overwrite each
other. For no-loss delivery, read the full `picks.jsonl` and filter by `targets`.
Target names are validated against `[a-z0-9_-]` to prevent path traversal, and the
server only accepts names configured in `targets`.

## MCP server

Besides the file bridge, the package ships an MCP server so any MCP client
(Claude Code, Cursor, Cline, …) can pull picks through tools.

```bash
npm i -D @modelcontextprotocol/sdk zod
```

Add this to your client's MCP config:

```json
{
  "mcpServers": {
    "picker": {
      "command": "npx",
      "args": ["picker-mcp", "--agent", "codex"]
    }
  }
}
```

Tools:

- `get_new_picks` — picks since the previous call (per-session cursor, no repeats)
- `get_last_pick` — the most recent pick
- `list_picks({ limit })` — recent picks

`--agent <name>` (or `PICKER_AGENT`) selects which targeted picks to receive;
broadcasts are always received. `--root <dir>` (or `PICKER_ROOT`) sets the project
root, defaulting to `process.cwd()`. `@modelcontextprotocol/sdk` and `zod` are
optional peer dependencies — install them only if you use MCP.

## Scope

- Vue 3 Single File Components (native DOM elements in the template)
- React/Preact style JSX, TSX
- Plain DOM on the same page
- Local Vite dev server

`iframe` and closed shadow DOM are not supported. A Vue dynamic component itself
is not instrumented, but the native DOM it renders can still be located through
the component template.

> Note: the overlay UI text is currently Chinese only; internationalisation is on
the roadmap.

## Security

The browser DOM only contains short locator ids, and absolute paths are resolved
on the local Vite server by id.

The `/__picker/*` endpoints are unauthenticated. Keep the dev server bound to
localhost; see [SECURITY.md](./SECURITY.md) for details.

## License

[MIT](./LICENSE)
