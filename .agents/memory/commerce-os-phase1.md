---
name: Commerce OS Phase 1
description: Key decisions, patterns, and gotchas from the Phase 1 MVP build of the Commerce OS merchant dashboard
---

## Auth
- JWT stored in `localStorage` as `commerce_token`; injected via `lib/api-client-react/src/custom-fetch.ts`
- JWT payload: `{ sub, tenantId, role, email, name }` — signed with `JWT_SECRET` env var (default dev secret)
- All protected routes use `requireAuth` middleware from `artifacts/api-server/src/middlewares/auth.ts`

## Multi-tenancy
- Every DB table has `tenant_id`; routes filter by `req.user!.tenantId` extracted from JWT
- Registration creates a Tenant + User atomically; slug = slugified storeName + random suffix

## DB / Drizzle patterns
- Numeric columns (price, total, etc.) use `numeric(12,2)` — Drizzle returns them as strings, must parseFloat() in routes
- Primary keys are text with $defaultFn(() => crypto.randomUUID())
- Passing `imageUrl: null` to Zod fails validation — omit the field when null

## OpenAPI naming
- Body schemas must be entity-shaped (ProductInput, not CreateProductBody) to avoid Orval TS2308 collision
- After any spec change: run codegen then typecheck:libs

## Workflow sequencing
- After lib/db/src/schema changes: run pnpm run typecheck:libs before api-server typecheck
- Dashboard workflow: `artifacts/dashboard: web`; API: `artifacts/api-server: API Server`

## Demo credentials
- Email: demo@commerce.os / Password: demo1234 / Tenant: Himalayan Goods
