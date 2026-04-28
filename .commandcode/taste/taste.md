# Taste (Continuously Learned by [CommandCode][cmd])

[cmd]: https://commandcode.ai/

# cli
See [cli/taste.md](cli/taste.md)

# typescript
See [typescript/taste.md](typescript/taste.md)
# code-style
- Write functional code only: no classes, `this`, or `new` (except `Map`, `Set`, `Error`). Compose pure functions over data. Confidence: 0.85
- Put error handling and guard clauses first; happy path last. Confidence: 0.80
- Never nest deeper than 2-3 levels; flatten with early `return`, `continue`, `break`. Confidence: 0.80
- Avoid `switch`/`case` and `else`; prefer if-guards. Confidence: 0.75
- Use Biome for linting and formatting. Confidence: 0.75

# workflow
- Dev loop before commit: write tests, then run `pnpm test`, `pnpm lint`, `pnpm typecheck` (`tsc --noEmit`), and `pnpm build`. Confidence: 0.80

# git
- Use conventional commit format: `<type>: <description>` with optional body. Allowed types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`. Confidence: 0.80

# npm
- Before `npm publish`, check name availability with `npx can-i-publish` (preferred over `npm-name-cli`), including dash variations (e.g., `tdot` vs `t-dot`). Confidence: 0.85
