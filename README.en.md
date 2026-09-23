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
6. **Push** (or press `Enter` in the textarea; `Shift+Enter` for a newline) injects
   the current pick into a session that is **running** right now. The button only
   exists when a push-capable agent is listening — see below. When the target
   cannot take a push, `Enter` does what **Copy** does instead.

## Delivery capability comes in three tiers

The word "push" is easy to abuse, so here is what each tier actually needs:

| Tier | Meaning | Requires | Reachable today |
|---|---|---|---|
| **Copy** | goes to the clipboard | nothing | everything |
| **Push** | injected into a **running** session, without waiting for it to speak | the host exposes an injection channel | **Pi only** |
| **Pull** | the agent asks for it | an MCP client | any MCP client |

The distinction that matters: **push requires the host to offer a way to inject
from outside and trigger a turn.** Pi does (its extension API's
`sendMessage(..., { triggerTurn: true })`). Claude Code and Codex hooks only fire
on lifecycle events, so they have no such entry point — the panel offers them
**Copy**, and their prompt hook can read `.picker/` on their next prompt instead
(see [docs/agents.md](./docs/agents.md)). That is a file-level read, not a panel
push.

So the panel does not lie:

- Only a host that can inject into a running session beats a heartbeat
(`.picker/listeners/<agent>.json`, refreshed every 2s). Pi is the only one today,
and the Claude Code and Codex hooks never beat one — they can never receive a
push.
- The **π switch** at the top-right of the prompt box is your own opt-in, kept per
browser. Push is off until you turn it on, and even then the push button only
appears while a heartbeat is fresh — so a success toast for a push that goes
nowhere is impossible.
- A heartbeat older than 10s (the agent closed) takes the button away again.

Any host that implements "heartbeat plus poll `push.json`" therefore becomes a
push target on its own — no agent names are hardcoded in the plugin. Conversely,
an agent that is only read on its next prompt must **not** beat a heartbeat, or
the panel would promise a push it cannot deliver.

Also: **every action writes the pick into `.picker/`** (Copy, Stash and Push
alike), so a failed push never loses the pick.

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

## Claude Code / Codex: use Copy

Pick an element, press **Copy** in the panel, switch to the agent and paste. That
is the recommended path for claude / codex, not a consolation prize:

**Copy**: `Alt`+click → write the request → Copy → switch window → `Ctrl+V` → `Enter`
**Hook**: `Alt`+click → write the request → Stash (any panel action writes the pick to `.picker/`) → switch window → type something → `Enter`

Same number of steps: the hook saves the paste (Stash never touches the
clipboard), and costs configuration, trust prompts and version fragility — while
pasting means you can see exactly what you are sending. Pi is the exception: it
can genuinely push.

## Making an agent read it automatically (optional)

The file bridge is passive: picks land in `.picker/`, but the agent side has to
read them. Besides Copy there are three ways.

**Option 1: say it in the chat (zero setup, any agent)**

> Read `.picker/inbox/pi.md` (or `.picker/last-pick.md`) and make the change it asks for.

**Option 2: the `picker-hook` command** — for when your workflow is fixed and you
are going to type in the agent anyway:

```bash
picker-hook --agent claude                # plain text; Claude Code adds it to the context
picker-hook --agent codex                 # Codex's UserPromptSubmit takes plain text too
picker-hook --agent codex --format codex  # or the explicit hookSpecificOutput JSON
```

It **always exits 0** (a non-zero exit would reject the prompt in Claude Code and
block it in Codex), prints **nothing** when there is nothing new, and delivers a
given pick once per agent. Each agent keeps its own cursor, so routing a pick to
`codex` does not consume it for `claude`.

⚠️ **Read this before wiring it up.** Hooks only fire on lifecycle events, and
neither Claude Code nor Codex can wake a running session from the outside. The
pick therefore arrives on your **next** prompt — you still have to send the agent
a message. Only Pi injects without you typing. Setup, including Codex's hook-trust
step, is in [docs/agents.md](./docs/agents.md).

**Option 3: MCP** — see the MCP server section below.

## Pi: genuine immediate push

Pi ships `.pi/extensions/picker-inbox.ts`, which polls `push.json` and injects
without waiting for you to type:

| Mode | Trigger | Behaviour |
|---|---|---|
| Pull | You send Pi a message | Inject the newest pick (default) |
| Push | Browser **Push** / `Enter`, or Pi `ctrl+alt+p` / `/picker` | Inject the current pick immediately |

Pi listens to `before_agent_start`; run `/reload` (or restart Pi) to load it.

> The difference matters: Pi is **real push** — it polls `push.json` and injects
> without waiting for you to type. Hook-based agents can only inject at a
> lifecycle event, so a pushed pick arrives on your **next prompt**.

## Where picks land

The panel has no target picker: every pick is a broadcast. Acting on a pick
(Copy, Stash or Push) is what writes it:

```
.picker/
├─ picks.jsonl        # full log, one JSON per line
├─ last-pick.md       # readable snapshot, "latest wins"
└─ push.json          # push request (once / target)
```

Agents that are read on their next prompt (a hook) read `last-pick.md` through
`picker-hook` — see [docs/agents.md](./docs/agents.md). For no-loss delivery,
read the full `picks.jsonl`.

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
