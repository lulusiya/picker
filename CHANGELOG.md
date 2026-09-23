# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-09-24

### Added

- A π switch at the top-right of the prompt box turns Pi push on and off per
  browser. Push is off until you turn it on, and the button only appears while a
  heartbeat is fresh.

### Changed

- The "Send to" routing row is gone: picks are always broadcast. The push target
  is no longer whatever the row said, so a stale selection can no longer hide a
  push that would have worked.
- A heartbeat now *means* "I can take a push right now". The `mode: 'push' | 'queue'`
  field is gone from the listener protocol and the panel no longer keeps a second
  "queue" notion for agents that are only read on their next prompt. Only hosts
  that can inject into a running session (Pi today) beat a heartbeat, so Claude
  Code and Codex can never receive a push - Copy is their path, plus whatever
  their own prompt hook reads from `.picker/`.
- Pressing `Enter` in the panel now does what the panel can actually do: it pushes
  when the switch is on and an agent is listening, and copies otherwise, instead
  of writing a `push.json` nobody reads and reporting a delivery that never
  happened.

### Removed

- The "Queue" tier from the delivery-capability documentation. The panel has
  three tiers: Copy, Push and Pull. Passive file pickup by a prompt hook is still
  documented in `docs/agents.md`; it is an integration, not a panel capability.

### Fixed

- A restarted Pi session replayed the last `push.json` request as soon as it
  polled, injecting a pick nobody had pushed in that session. The listener now
  treats the `once` value already on disk as consumed when the session starts.

## [0.4.0] - 2026-09-24

### Added

- Delivery capability is now discovered instead of assumed. A push-capable agent
  beats a heartbeat at `.picker/listeners/<agent>.json` while it runs, the plugin
  exposes `/__picker/listeners`, and the panel renders its push action from that.
  The push button is not rendered when nothing is listening, so
  it can no longer report success for a push that goes nowhere. Any host that
  beats a heartbeat and polls `push.json` becomes a push target without plugin
  changes.
- `picker-hook`, a hook command that turns the passive file bridge into prompt
  context for Claude Code and Codex. It never exits non-zero (a non-zero exit
  rejects the prompt in Claude Code and blocks it in Codex), stays silent when
  there is nothing new, and keeps per-agent delivery state so routing a pick to
  one agent does not consume it for another.
- `docs/agents.md`, covering setup for Claude Code, Codex, Pi and MCP, plus the
  heartbeat protocol for hosts that can inject into a live session.
- `npm run test:dist` smoke-tests the built entry points in both module formats;
  CI now runs it after the build.
- A recorded demo GIF and a social preview image under `docs/`.

### Changed

- Pushing now requires a live listener and is refused with HTTP 409 otherwise,
  instead of writing a `push.json` timestamp nobody reads and letting the panel
  claim success. Copy stays the recommended path for agents without an injection
  channel.
- The Vue compilers are required on first use instead of at import time, which
  takes about 55 ms off dev-server start for projects that never load a `.vue`
  file.
- The bundled demo is a realistic console UI instead of a self-labelled
  verification harness.
- `bin.picker-mcp` is `dist/mcp.js` rather than `./dist/mcp.js`, which removes a
  warning on every publish.
- `demo/.hallmark/` is no longer tracked, and `.npmrc` is ignored so a registry
  token cannot be committed by accident.

### Removed

- The "open in editor" panel action and its `openInEditor` option. It reached
  out to Vite's `/__open-in-editor`, which starts an editor process on your
  machine from a browser click - a side effect a dev overlay should not have.
  Existing configs that still pass `openInEditor` keep working; the option is
  simply ignored.

### Fixed

- The CommonJS bundle could not be required at all: esbuild compiled
  `import.meta.url` to `undefined` in the CJS output, so creating the require
  function threw before the plugin was loaded. The build now passes `--shims`.
- `instrumentJsx` and `instrumentVueSfc` threw on sources they could not parse,
  such as Svelte or Astro files, even though both declare `TransformResult | null`.
  They now return `null`.

## [0.3.0] - 2026-09-23

First public release.

### Added

- `Alt`+hover highlight and `Alt`+click picker for native DOM elements in
  Vue 3 SFC templates and JSX/TSX.
- Prompt panel showing the source location (`file:line:column`) and the
  component chain (`range`).
- Stash tray with multi-select, in-place editing and batch copy/delete.
- Open the picked source in the editor through Vite's `/__open-in-editor`,
  so the editor is auto-detected.
- File bridge under `.picker/`: `picks.jsonl`, `last-pick.md`,
  `inbox/<agent>.md` and `push.json`.
- Multi-agent routing via the `targets` option, with per-agent inbox files.
- Push a pick to an agent session: browser button / `Enter`, the `picker-mcp`
  tools, or the bundled Pi extension.
- MCP server (`picker-mcp`) exposing `get_new_picks`, `get_last_pick` and
  `list_picks`.
- Pi extension example at `.pi/extensions/picker-inbox.ts`.

### Changed

- The overlay UI is themed through `--picker-*` CSS custom properties and uses a
  blue accent.
- The old `editor` option is replaced by `openInEditor`; editor detection is
  delegated to Vite.

### Fixed

- Stale source records are evicted on hot update, so edited files no longer
  resolve to shifted line numbers.

[Unreleased]: https://github.com/lulusiya/picker/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/lulusiya/picker/releases/tag/v0.5.0
[0.4.0]: https://github.com/lulusiya/picker/releases/tag/v0.4.0
[0.3.0]: https://github.com/lulusiya/picker/releases/tag/v0.3.0
