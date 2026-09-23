# Changelog

All notable changes to this project are documented here. The format is based on
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/lulusiya/picker/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/lulusiya/picker/releases/tag/v0.3.0
