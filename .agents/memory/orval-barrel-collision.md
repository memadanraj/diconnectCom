---
name: Orval barrel collision fix
description: Orval regenerates lib/api-zod/src/index.ts with both ./generated/api and ./generated/types on every codegen run, causing TS2308 duplicate export errors.
---

The rule: `lib/api-zod/src/index.ts` must only re-export `./generated/api`. Never export `./generated/types`.

**Why:** Orval in `mode: split` generates a `types/` subdirectory and puts both in the barrel. When path+query params combine, types get duplicated across both barrels (e.g. `ListInventoryTransactionsParams` appears in both), causing TS2308.

**How to apply:** The codegen script in `lib/api-spec/package.json` overwrites the file right after `orval`:
```json
"codegen": "orval --config ./orval.config.ts && node -e \"require('fs').writeFileSync('../../lib/api-zod/src/index.ts', \\\"export * from \\\\\\\"./generated/api\\\\\\\";\\\\n\\\")\" && pnpm -w run typecheck:libs"
```
If the error reappears, check whether `lib/api-zod/src/index.ts` has two export lines; if so, delete the `./generated/types` line.
