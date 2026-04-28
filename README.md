![eeenv](https://github.com/ahmadawais/eeenv/blob/main/.github/image.png?raw=true)

# eeenv

Hide your project `.env` files from coding agents. Encrypts real values into
`~/.eeenv/vault/`, then replaces local files with random tokens. Your passphrase
is stored in the OS keychain — AI agents can't access it without your biometrics.

## Install

```sh
npm install -g eeenv
```

## Quick start

```sh
# From your project root — recursively finds every .env* / .dev.vars* file:
eeenv hide
# First run: set a passphrase (stored in your OS keychain)

# Coding agents now see random tokens instead of real values.
# Work safely. When you're done:

eeenv restore
# If passphrase not in keychain: prompts you to enter it
```

## How it works

1. **Encryption**: Real values are encrypted with AES-256-GCM using your passphrase
2. **Keychain**: Your passphrase lives in the OS keychain (macOS `security`, Linux `secret-tool`, Windows Credential Manager)
3. **Redaction**: Local files get random tokens like `eeenv_redacted_abc123...`
4. **Protection**: AI agents can't read the keychain without your system password/biometrics

## Commands

### `eeenv status`

Show what's tracked and what's discoverable.

```
$ eeenv status
Project: /Users/you/project
Vault:   ~/.eeenv/vault/Users/you/project
Keychain: passphrase in keychain

  hidden .env (2026-04-28T12:00:00.000Z)
  hidden packages/api/.env (2026-04-28T12:00:00.000Z)

Untracked env files:
  · .env.production

Skipped via .eeenv.json ignoreFiles:
  · .env.local
  · packages/legacy/.env
```

### `eeenv hide`

Encrypts every discovered env file into `~/.eeenv/vault/<absolute-project-path>/`,
then rewrites local files with redacted random tokens.

**First run** — prompts you to set a passphrase:
```
$ eeenv hide
Set a vault passphrase: ********
Confirm passphrase: ********
✓ Passphrase saved to OS keychain.
✓ hidden .env — vaulted real values, redacted 14 key(s) locally.
✓ hidden packages/api/.env — vaulted real values, redacted 3 key(s) locally.
• Run eeenv restore to put real values back.
```

**Subsequent runs** — uses existing passphrase from keychain:
```
$ eeenv hide
✓ hidden .env — vaulted real values, redacted 14 key(s) locally.
```

**Double-hide protection** — blocks if files already redacted:
```
$ eeenv hide
✗ Cannot hide — some files appear to already be redacted:
  .env — already tracked in vault (run eeenv restore first)
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

Decrypts files from the vault and restores them to their original locations.

**Passphrase in keychain** — seamless restore:
```
$ eeenv restore
✓ restored .env
✓ restored packages/api/.env
```

**Passphrase not in keychain** — prompts to unlock:
```
$ eeenv restore
Vault is locked. Enter passphrase to unlock: ********
✓ Vault unlocked.
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
   ├─ .env                   # encrypted real values (AES-256-GCM)
   ├─ apps/
   │  └─ web/
   │     └─ .env             # encrypted
   └─ packages/
      └─ api/
         ├─ .env             # encrypted
         └─ .dev.vars        # encrypted
```

The vault mirrors your project tree exactly. Files are encrypted with
AES-256-GCM using your passphrase. The passphrase is stored in your OS
keychain — AI agents cannot access it without your system password/biometrics.

## Security

- **AES-256-GCM encryption**: Real values are encrypted, not just copied
- **OS keychain**: Passphrase lives in macOS Keychain, Linux Secret Service,
  or Windows Credential Manager — requires your biometrics/system password
- **Double-hide protection**: Blocks `hide` if files already redacted or tracked
- **Random tokens**: Each redacted value is a fresh 24-hex-char random token.
  No deterministic mapping, no length leak.
- **Permission-locked**: Vault files are created with mode `0o600`
  (owner read/write only).
- **Comment-preserving**: Comments, blank lines, and `export` statements are
  preserved during redaction. Only the `VALUE` part of `KEY=VALUE` is
  replaced.

## Monorepos

Works automatically. Run from any directory — `eeenv` walks the tree
from the current directory downward. A `.env` at `packages/api/.env` and
another at `apps/web/.env` are tracked separately under their relative
paths. The vault mirrors the same structure. No collisions across packages.

## Cloudflare Workers

`.dev.vars` and `.dev.vars.*` files are discovered and processed identically
to `.env` files. Same encryption, same redaction, same restore. Templates like
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
