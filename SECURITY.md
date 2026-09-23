# Security

This is a **development-only** tool. The plugin is applied only while the Vite
dev server runs (`apply: 'serve'`) and is never part of a production build.

## Please do not expose the dev server

The dev endpoints under `/__picker/*` are unauthenticated and can:

- return absolute source paths (`/__picker/source`, `/__picker/picks`)
- append to `.picker/` inside your project (`/__picker/record`)
- trigger the editor through Vite's `/__open-in-editor`

If you run Vite with `--host` (for example `--host 0.0.0.0`) on an untrusted
network, anyone who can reach the port can read those paths and open files in
your editor. Keep the dev server bound to localhost, or put it behind a trusted
network.

Absolute paths stay on the dev server: the browser only ever receives a short
locator id, and `/__picker/record` refuses ids that were not produced by the
transform.

## Reporting a vulnerability

Please open a private security advisory on GitHub, or email the maintainer
instead of filing a public issue. We aim to respond within a few days.
