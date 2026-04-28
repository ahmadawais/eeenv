# demo-app (monorepo)

A pnpm-style monorepo to try the `eeenv` CLI on. Every `.env*` here contains
**fake** credentials — safe to commit in this example, never use in real
projects.

## Layout

```
demo-app/
├─ .env                       ← root secrets (Stripe, OpenAI, AWS, …)
├─ .env.local                 ← per-developer overrides
├─ .env.production            ← non-secret prod config
├─ .env.example               ← template (eeenv leaves this alone)
├─ pnpm-workspace.yaml
├─ apps/
│  └─ web/
│     ├─ .env                 ← web app secrets
│     ├─ .env.local
│     └─ package.json
└─ packages/
   ├─ api/
   │  ├─ .env                 ← API server secrets
   │  └─ package.json
   └─ worker/
      ├─ .env                 ← background worker secrets
      └─ package.json
```

`eeenv` walks the project recursively. `node_modules`, `.git`, `dist`,
`build`, `.next`, `.turbo`, `.cache`, `coverage`, `.venv`, etc. are skipped
automatically. Symlinked directories are not followed.

## One-time setup

From the repo root:

```sh
pnpm install
pnpm build
pnpm link --global
```

`eeenv` is now on your `$PATH`.

## Try it

```sh
cd examples/demo-app

# 1. See every .env file the tool would touch:
eeenv status
#   Untracked .env files:
#     · .env
#     · .env.local
#     · .env.production
#     · apps/web/.env
#     · apps/web/.env.local
#     · packages/api/.env
#     · packages/worker/.env

# 2. Vault real values, redact local files:
eeenv hide
cat apps/web/.env
#   NEXT_PUBLIC_API_URL=eeenv_redacted_<random-hex>
#   SESSION_SECRET=eeenv_redacted_<random-hex>
#   …

# 3. Real values are sitting safely in the vault, mirroring the project tree:
ls -R ~/.eeenv/vault"$(pwd)"
cat ~/.eeenv/vault"$(pwd)"/.eeenv.json   # manifest with state per file

# 4. Bring everything back when you’re done:
eeenv restore
```

## Reset

```sh
eeenv restore || true
rm -rf ~/.eeenv/vault"$(pwd)"
```
