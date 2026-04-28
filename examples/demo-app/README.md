# demo-app (monorepo)

A pnpm-style monorepo to try the `eeenv` CLI on. Every `.env*` and `.dev.vars*`
here contains **fake** credentials — safe to commit in this example, never use
in real projects.

## Layout

```
demo-app/
├─ .env                       ← root secrets (Stripe, OpenAI, AWS, …)
├─ .env.local                 ← per-developer overrides (skipped via ignoreFiles)
├─ .env.production            ← non-secret prod config
├─ .env.example               ← template (excluded from discovery)
├─ .eeenv.json                ← project config (skipKeys + ignoreFiles)
├─ pnpm-workspace.yaml
├─ apps/
│  └─ web/
│     ├─ .env                 ← web app secrets
│     ├─ .env.local           ← per-developer overrides (skipped via ignoreFiles)
│     ├─ .dev.vars            ← Cloudflare Pages dev vars
│     └─ package.json
└─ packages/
   ├─ api/
   │  ├─ .env                 ← API server secrets
   │  ├─ .dev.vars            ← Cloudflare dev vars
   │  ├─ .dev.vars.example    ← template (excluded from discovery)
   │  └─ package.json
   └─ worker/
      ├─ .env                 ← background worker secrets
      ├─ .dev.vars            ← Cloudflare Workers dev vars
      └─ package.json
```

## What eeenv discovers

By default `eeenv` walks the project **recursively** and picks up:

| Pattern               | Example                      |
|-----------------------|------------------------------|
| `.env`                | `.env`                       |
| `.env.<anything>`     | `.env.local`, `.env.development` |
| `.dev.vars`           | `.dev.vars`                  |
| `.dev.vars.<anything>`| `.dev.vars.production`       |

**Excluded across the tree** — never discovered:

| Category       | Examples                                       |
|----------------|------------------------------------------------|
| Templates      | `.env.example`, `.dev.vars.example`, `.env.sample`, `.env.template`, `.env.dist` |
| Noise dirs     | `node_modules`, `.git`, `.hg`, `dist`, `build`, `out`, `output`, `.output`, `.next`, `.nuxt`, `.turbo`, `.cache`, `.parcel-cache`, `.svelte-kit`, `.astro`, `.vercel`, `.netlify`, `.serverless`, `.wrangler`, `.eslintcache`, `.rollup.cache`, `.vite`, `coverage`, `.nyc_output`, `.eeenv`, `.idea`, `.vscode-test`, `target`, `__pycache__`, `.venv`, `venv`, `.pnpm-store`, `.yarn`, `.npm`, `bower_components`, `vendor` |
| Symlinks       | Symlinked directories are never followed       |

## Config: `.eeenv.json`

Place this file at your project root to control what gets redacted or skipped:

```json
{
  "skipKeys": [
    "NODE_ENV",
    "DEBUG",
    "NEXT_PUBLIC_API_URL",
    "VERCEL_ENV",
    "CI",
    "PORT"
  ],
  "ignoreFiles": [
    ".env.local",
    "packages/one/**",
    "packages/two/**"
  ]
}
```

- **`skipKeys`** — Case-sensitive env key names that should **keep their real
  values** locally after `eeenv hide`. Everything else gets a random token.
  The file is still byte-copied to the vault, so `eeenv restore` can bring
  everything back fully.
- **`ignoreFiles`** — [minimatch][] globs matched against the
  **project-relative path** (e.g. `apps/web/.env`, `packages/api/.env`).
  Files matching any pattern are **never vaulted and never redacted**.
  `matchBase` is enabled, so a plain filename like `.env.local` matches
  anywhere in the tree.

This demo's `.eeenv.json` skips all `.env.local` files plus the
`packages/one/` and `packages/two/` test directories.

[minimatch]: https://github.com/isaacs/minimatch#readme

## One-time CLI setup

From the repo root:

```sh
pnpm install
pnpm build
pnpm link --global
```

`eeenv` is now on your `$PATH`.

## Walkthrough

```sh
cd examples/demo-app
```

### 1. Status (before)

```sh
eeenv status
```

Shows every discovered file the tool would touch. Files covered by
`ignoreFiles` won't appear — this demo's config skips both `packages/one/`,
`packages/two/`, and all `.env.local` files.

### 2. Hide everything

```sh
eeenv hide
```

Every discovered env file is byte-copied into the vault at
`~/.eeenv/vault/<absolute-project-path>/`, then rewritten locally with
redacted tokens. Keys in `skipKeys` keep their real values locally (but are
also vaulted).

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

The original file is safe in the vault. Coding agents reading the local file
see random tokens.

### 3. Inspect the vault

```sh
ls -R ~/.eeenv/vault"$(pwd)"

cat ~/.eeenv/vault"$(pwd)"/manifest.json
```

The vault mirrors your project tree. The manifest tracks which files are
hidden and when.

### 4. Check status again

```sh
eeenv status
```

Now shows `hidden` next to every file that was vaulted. Should see `.env`,
`.env.production`, `apps/web/.env`, `apps/web/.dev.vars`,
`packages/api/.env`, `packages/api/.dev.vars`, `packages/worker/.env`,
`packages/worker/.dev.vars`, plus whatever you have in `packages/one/` and
`packages/two/` (if any).

### 5. Restore everything

```sh
eeenv restore
```

Copies every file back from the vault to its original location. Real values
are restored. The manifest is cleared.

### 6. Verify

```sh
head -4 apps/web/.env
# NEXT_PUBLIC_API_URL=https://api.demo.local
# SESSION_SECRET=demo-session-secret-DO-NOT-USE
# SENTRY_DSN=https://demo@sentry.local/1
```

## Reset

```sh
eeenv restore || true
rm -rf ~/.eeenv/vault"$(pwd)"
```
