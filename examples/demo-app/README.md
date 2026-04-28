# demo-app

A throwaway project to try every `eeenv` command against. The `.env*` files
here contain fake credentials — safe to commit in this example, never use in
real projects.

## Files in this folder

| File              | What it is                              | eeenv touches it? |
| ----------------- | --------------------------------------- | ----------------- |
| `.env`            | Main secrets (Stripe, DB, OpenAI, AWS…) | Yes               |
| `.env.local`      | Per-developer overrides                 | Yes               |
| `.env.production` | Non-secret prod config                  | Yes               |
| `.env.example`    | Template committed to git               | **No** (excluded) |

## One-time setup

From the repo root, build and link the CLI globally:

```sh
pnpm install
pnpm build
pnpm link --global
```

Now `eeenv` is on your `$PATH`. Then `cd` into this folder:

```sh
cd examples/demo-app
```

## Try every command

### 1. See what's there

```sh
eeenv status
```

Shows the project path, vault path (`~/.eeenv/vault/<absolute-path>/`),
and lists `.env`, `.env.local`, `.env.production` as **untracked**.
`.env.example` is ignored.

### 2. Hide — vault real values, leave redacted stubs locally

```sh
eeenv hide
cat .env
```

Local `.env` now reads:

```env
# --- demo-app secrets (FAKE — safe to commit in this example) ---

STRIPE_SECRET_KEY=eeenv_redacted_<random-hex>
DATABASE_URL=eeenv_redacted_<random-hex>
…
export AWS_ACCESS_KEY_ID=eeenv_redacted_<random-hex>
```

Real values live in `~/.eeenv/vault/<this-folder>/`. A coding agent reading
the project sees only random tokens. Comments, blank lines, and the `export`
prefix are preserved.

### 3. Restore — put real values back

```sh
eeenv restore
cat .env
```

Original values are back. `eeenv status` shows nothing tracked.

### 4. Global — move files out of the project

```sh
eeenv global
ls -A | grep .env
```

Only `.env.example` remains. The rest were **moved** into the vault.

### 5. Local — move them back

```sh
eeenv local
ls -A | grep .env
```

All files are back where they started.

### 6. Copy — keep local, mirror to vault

```sh
eeenv copy
eeenv status
```

Both the local files and a vault copy exist. Useful as a quick backup before
editing.

## Inspect the vault

```sh
ls -la ~/.eeenv/vault"$(pwd)"
cat ~/.eeenv/vault"$(pwd)"/.eeenv.json  # manifest (state per file)
```

## Reset

```sh
eeenv restore || true
eeenv local   || true
rm -rf ~/.eeenv/vault"$(pwd)"
```
