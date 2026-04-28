# eeenv

Hide your project `.env` files from coding agents. Byte-copies real values into
`~/.eeenv/vault/`, then replaces local files with random tokens. When you're
done, restore everything with one command.

## Install

```sh
npm install -g eeenv
```

## Quick start

```sh
# From your project root — recursively finds every .env* / .dev.vars* file:
eeenv hide

# Coding agents now see random tokens instead of real values.
# Work safely. When you're done:

eeenv restore
```

## Commands

### `eeenv status`

Show what's tracked and what's discoverable.

```
$ eeenv status
Project: /Users/you/project
Vault:   ~/.eeenv/vault/Users/you/project

  hidden .env (2026-04-28T12:00:00.000Z)
  hidden packages/api/.env (2026-04-28T12:00:00.000Z)

Untracked env files:
  · .env.production

Skipped via .eeenv.json ignoreFiles:
  · .env.local
  · .env.development
```

### `eeenv hide`

Byte-copies every discovered env file into `~/.eeenv/vault/<absolute-project-path>/`,
then rewrites local files with redacted random tokens. The original values
never enter JavaScript memory — files are copied at the OS level.

```
$ eeenv hide
✓ hidden .env — vaulted real values, redacted 14 key(s) locally.
✓ hidden packages/api/.env — vaulted real values, redacted 3 key(s) locally.
• Run eeenv restore to put real values back.
```

**Before:**
```
STRIPE_KEY=sk_live_supersecret
NODE_ENV=production
```

**After:**
```
STRIPE_KEY=eeenv_redacted_c87f3a1b2c4d5e6f7a8b9c0d1e2f3a4b
NODE_ENV=production
```

### `eeenv restore`

Copies every file back from the vault to its original location. Real values
are fully restored.

```
$ eeenv restore
✓ restored .env
✓ restored packages/api/.env
```

## What gets discovered

`eeenv` walks your project **recursively** and picks up:

| Pattern                 | Example                     |
|-------------------------|-----------------------------|
| `.env`                  | `.env`                      |
| `.env.<anything>`       | `.env.local`, `.env.staging`|
| `.dev.vars`             | `.dev.vars`                 |
| `.dev.vars.<anything>`  | `.dev.vars.production`      |

### Never touched

| Category     | Examples                                                                                    |
|-------------|---------------------------------------------------------------------------------------------|
| Templates    | `.env.example`, `.dev.vars.example`, `.env.sample`, `.env.template`, `.env.dist`            |
| Noise dirs   | `node_modules`, `.git`, `dist`, `build`, `.next`, `.turbo`, `.cache`, `coverage`, `vendor`, `.venv`, `.pnpm-store`, `.yarn`, `target`, `__pycache__` — [full list below](#skipped-directories) |
| Symlinks     | Symlinked directories are never followed                                                    |

## Config: `.eeenv.json`

Place this at your project root. All fields are optional.

```json
{
  "skipKeys": ["NODE_ENV", "DEBUG", "PORT", "CI"],
  "ignoreFiles": [".env.local", "packages/legacy/**"]
}
```

### `skipKeys`

Case-sensitive env key names that **keep their real values** locally after
`eeenv hide`. The file is still vaulted — `eeenv restore` brings everything
back. Useful for non-sensitive vars that apps need at runtime.

### `ignoreFiles`

[minimatch][] globs matched against the **project-relative path**
(e.g. `apps/web/.env`). Files matching any pattern are **never vaulted and
never redacted**. `matchBase` is enabled, so a plain filename like
`.env.local` matches everywhere in the tree.

[minimatch]: https://github.com/isaacs/minimatch#readme

### Built-in defaults

Even without a `.eeenv.json`, these files are skipped:

- `.env.local`
- `.env.development`
- `.env.test`

Override by setting `ignoreFiles` explicitly.

## How the vault works

```
~/.eeenv/vault/
└─ <absolute-project-path>/
   ├─ manifest.json          # tracks which files are hidden
   ├─ .env                   # vaulted real values
   ├─ apps/
   │  └─ web/
   │     └─ .env
   └─ packages/
      └─ api/
         ├─ .env
         └─ .dev.vars
```

The vault mirrors your project tree exactly. File paths are relative from
the project root. A file at `<project>/apps/web/.env` lives in the vault at
`~/.eeenv/vault/<project>/apps/web/.env`.

## Security

- **Byte-copy**: `.env` files are copied with `fs.copyFile` — real values
  never enter JavaScript memory during vaulting.
- **Random tokens**: Each redacted value is a fresh 24-hex-char random token.
  No deterministic mapping, no length leak.
- **Permission-locked**: Vault files are created with mode `0o600`
  (owner read/write only).
- **Comment-preserving**: Comments, blank lines, and `export` statements are
  preserved during redaction. Only the `VALUE` part of `KEY=VALUE` is
  replaced.

## Monorepos

Works automatically. Run from any directory — `eeenv` walks the tree
upward? No, it walks downward from the current directory.
A `.env` at `packages/api/.env` and another at `apps/web/.env` are tracked
separately under their relative paths. The vault mirrors the same structure.
No collisions across packages.

## Cloudflare Workers

`.dev.vars` and `.dev.vars.*` files are discovered and processed identically
to `.env` files. Same vaulting, same redaction, same restore. Templates like
`.dev.vars.example` are excluded.

## Skipped directories

Recursion skips these directories by name:

`.git` `.hg` `.svn`
`node_modules` `.pnpm-store` `.yarn` `.npm` `bower_components` `vendor`
`dist` `build` `out` `output` `.output`
`.next` `.nuxt` `.turbo`
`.cache` `.parcel-cache`
`.svelte-kit` `.astro`
`.vercel` `.netlify` `.serverless` `.wrangler`
`.eslintcache` `.rollup.cache` `.vite`
`coverage` `.nyc_output`
`.eeenv` `.idea` `.vscode-test`
`target` `__pycache__` `.venv` `venv`

## Reset everything

```sh
# Restore all vaulted files for the current project:
eeenv restore

# Or nuke the entire vault:
rm -rf ~/.eeenv
```

## Uninstall

```sh
npm uninstall -g eeenv
rm -rf ~/.eeenv
```

## License

MIT
