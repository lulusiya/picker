# Wiring picks into an agent

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
| `--agent`, `PICKER_AGENT` | *(none)* | Name from the plugin's `targets` option. Selects `inbox/<agent>.md` over `last-pick.md`. |
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

Set `PICKER_AGENT` to match a name in `targets` (defaults to `pi`), then
`/reload`.

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
| Codex ignores it | Run `/hooks` and trust the definition. |
| Claude Code ignores it | `claude --debug` prints hook stdout and exit codes. Confirm the command runs from the project root. |
| Wrong project | Pass `--root`, or set `PICKER_ROOT`. |
