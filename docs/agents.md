# Wiring picks into an agent

## Read this first

**For Claude Code and Codex, prefer Copy.** Press **Copy** in the pick panel and
paste into the agent. Both flows take the same number of steps:

| | Copy | Hook |
|---|---|---|
| Browser | `Alt`+click, write the request, Copy | `Alt`+click, write the request, Stash |
| Agent | switch window, `Ctrl+V`, `Enter` | switch window, type something, `Enter` |
| Setup | none | config file, plus a trust prompt in Codex |

The hook saves you a paste - any panel action (Copy, Stash, Push) writes the pick
to `.picker/`, and Stash never touches the clipboard. Copy shows you exactly what
you are sending, needs no setup, works with any agent, and cannot break when a
host changes its hook format.

**Neither Claude Code nor Codex can wake a running session from the outside.**
Hooks fire on lifecycle events (`UserPromptSubmit`, tool calls), so a pick is
queued until the agent next speaks — you still have to send it a message. Only Pi
can inject without you typing (see [Pi](#pi) below).

Reach for `picker-hook` when your workflow is fixed and you are going to type in
the agent anyway, so the pick context rides along with what you were already
going to say. It is also the right tool if you want a pick to arrive without
living in your clipboard.

## How delivery works

The file bridge is **passive**: writing `.picker/inbox/<agent>.md` puts a pick on
disk, but nothing reads it until an agent asks. `picker-hook` is that reader — a
small CLI meant to be called from an agent's prompt hook.

```
browser Alt+click
      │
      ▼
.picker/picks.jsonl          append-only log
.picker/last-pick.md         broadcast snapshot
.picker/inbox/<agent>.md     routed snapshot
      │
      ▼
picker-hook --agent <name>   ← your agent calls this on every prompt
      │
      ▼
stdout                       ← the agent adds it to the model context
```

## `picker-hook`

```bash
picker-hook [--agent <name>] [--format text|codex] [--root <dir>] [--force]
```

| Flag / env | Default | Meaning |
|---|---|---|
| `--agent`, `PICKER_AGENT` | *(none)* | Name this agent answers to. Prefers `inbox/<agent>.md` over `last-pick.md` when one exists, and keeps this agent's own delivery cursor. |
| `--format`, `PICKER_HOOK_FORMAT` | `text` | `text` prints the block; `codex` prints the `hookSpecificOutput` JSON envelope. |
| `--root`, `PICKER_ROOT` | `process.cwd()` | Where to start looking for `.picker`. Searches downwards first, then upwards. |
| `--force` | off | Emit even if this pick was already delivered. For testing. |

Behaviour that matters when you attach it to a prompt hook:

- **Always exits 0.** A non-zero exit rejects the prompt in Claude Code and
  blocks it in Codex, so a broken hook would break your session.
- **Prints nothing when there is nothing new.** The same pick is delivered once
  per agent; delivery state lives in `.picker/.hook/<agent>.json`. Deleting that
  file makes the next run deliver again.
- **Clicking 推送 re-arms delivery.** The button bumps `push.json`, which counts
  as new even when the snapshot file itself did not change.

Each agent keeps its own cursor, so routing a pick to `codex` does not consume it
for `claude`.

## Claude Code

Add a hook group. Existing groups are independent, so append one rather than
editing what is already in the file.

> Remember: this only saves the paste. If you would rather paste, skip this
> section entirely.

`.claude/settings.json` (project) or `~/.claude/settings.json` (all projects):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx --no-install picker-hook --agent claude",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Claude Code adds a `UserPromptSubmit` hook's stdout to the model context, so the
plain `text` format is enough. `npx --no-install` resolves the binary from the
project's `node_modules/.bin`, which requires `vite-plugin-picker` to be a
dependency of the project the agent is running in.

## Codex

`.codex/hooks.json` (project) or `~/.codex/hooks.json` (all projects):

```json
{
  "hooks": {
    "UserPromptSubmit": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "npx --no-install picker-hook --agent codex",
            "commandWindows": "npx.cmd --no-install picker-hook --agent codex",
            "timeout": 10
          }
        ]
      }
    ]
  }
}
```

Two Codex-specific steps:

1. **Trust the hook.** Codex skips an untrusted hook and prints a warning. Run
   `/hooks` inside Codex to review and trust it. Trust is recorded against the
   hook's exact definition, so editing the command means trusting it again.
2. **Hooks must be enabled.** Recent builds have them on by default; the disable
   switch is `[features] hooks = false` in `config.toml`.

Codex also adds plain stdout from `UserPromptSubmit` to the developer context, so
`--format text` works here too. `--format codex` sends the explicit
`hookSpecificOutput.additionalContext` envelope instead.

> Codex hooks are newer than Claude Code's and have moved quickly. Check
> `codex --version` and the [hooks reference](https://developers.openai.com/codex/hooks)
> if the shape does not match your build.

## Pi

Bundled — see [`.pi/extensions/picker-inbox.ts`](../.pi/extensions/picker-inbox.ts).
Pi is the only target with **true push**: the extension polls `push.json` and
injects immediately, without waiting for you to type. Hook-based agents can only
inject at a lifecycle event, so a pushed pick arrives on your next prompt.

Set `PICKER_AGENT` to the name this session should answer to (defaults to `pi`),
then `/reload`.

## Implementing push for your own agent

Push needs the host to offer a way to inject from outside and trigger a turn —
Pi's extension API has one, Claude Code and Codex hooks do not. If your host can
do that, the plugin will discover it without any configuration.

Two things to implement:

**1. Beat a heartbeat while running.** Write
the file every couple of seconds and remove it on shutdown. A fresh heartbeat
*means* "I can take a push right now"; a host that can only be read on its next
prompt must not beat at all:

```jsonc
// <stateDir>/listeners/<agent>.json
{ "agent": "pi", "pid": 1234, "at": 1790189366374 }
```

`at` is epoch milliseconds. A heartbeat older than **10 seconds** counts as gone,
which is how a crashed agent stops being offered.

**2. Poll `<stateDir>/push.json` and inject when it changes.**

The panel writes it when someone presses Push:

```jsonc
{ "once": 1790189366424, "target": "pi" } // target "" means broadcast
```

Inject when `once` is greater than the last value you saw, and ignore it when
`target` names a different agent. On startup, seed "the last value you saw" from
`push.json` itself - the file outlives your process, so starting from zero would
replay a push that was already handled. In Pi this is `sendMessage({...}, {
deliverAs: 'followUp', triggerTurn: true })`.

The panel renders its π push switch from `/__picker/listeners`: a fresh heartbeat
is what lights the switch's dot and reveals the push button once you have turned
the switch on. **Push is refused with HTTP 409 when no listener is live** — the
server will not write a `push.json` that nobody will read.

## MCP instead of a hook

Anything that speaks MCP can pull picks without a hook:

```json
{
  "mcpServers": {
    "picker": { "command": "npx", "args": ["picker-mcp", "--agent", "claude"] }
  }
}
```

MCP is pull-based: the model decides when to call `get_new_picks`. A hook is
push-based and happens whether or not the model thinks to look.

## Troubleshooting

| Symptom | Check |
|---|---|
| Nothing ever appears | Does `.picker/inbox/<agent>.md` exist? The pick only goes there if you selected that target in the panel — otherwise it lands in `last-pick.md`. |
| Appears once, never again | Working as intended. Bump it with the 推送 button, or delete `.picker/.hook/<agent>.json`. |
| Want to see the raw output | `picker-hook --agent codex --force` |
| No Push button in the panel | Nothing is beating a heartbeat. Start the agent, or check `.picker/listeners/`. Paste instead — every action already writes the pick to `.picker/`. |
| Codex ignores it | Run `/hooks` and trust the definition. |
| Claude Code ignores it | `claude --debug` prints hook stdout and exit codes. Confirm the command runs from the project root. |
| Wrong project | Pass `--root`, or set `PICKER_ROOT`. |
