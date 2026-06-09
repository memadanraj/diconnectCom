# Commerce OS

A multi-tenant SaaS commerce platform enabling merchants to manage their online store — products, categories, orders, inventory, customers, and shipments — from a single dashboard.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 8080)
- `pnpm --filter @workspace/dashboard run dev` — run the merchant dashboard (port varies)
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required env: `DATABASE_URL` — Postgres connection string

## Demo Login

- Email: `demo@commerce.os`
- Password: `demo1234`

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- API: Express 5 + JWT auth (jsonwebtoken) + bcryptjs
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)
- Frontend: React + Vite + TanStack Query + Recharts + Shadcn/UI

## Where things live

- DB schema: `lib/db/src/schema/` — tenants, users, categories, products, orders, order_items, warehouses, inventory, inventory_transactions, customers, customer_addresses, shipments, shipment_events
- API contract: `lib/api-spec/openapi.yaml`
- Generated hooks: `lib/api-client-react/src/generated/`
- Generated Zod schemas: `lib/api-zod/src/generated/`
- Backend routes: `artifacts/api-server/src/routes/` — auth, tenants, categories, products, orders, dashboard, warehouses, inventory, customers, shipments
- Auth middleware: `artifacts/api-server/src/middlewares/auth.ts`
- Frontend: `artifacts/dashboard/src/`

## Architecture decisions

- JWT stored in `localStorage` as `commerce_token`; attached as `Authorization: Bearer` header via `custom-fetch.ts`
- Multi-tenant: every DB table has `tenant_id`; routes filter by `req.user.tenantId` from JWT
- Orders use a ledger-style order number `ORD-YYYYMMDD-XXXXX`
- Numeric DB columns (price, total) stored as PostgreSQL `numeric` — parse with `parseFloat()` on read
- OpenAPI spec is entity-first: body schemas named `ProductInput`, `OrderInput` (not `CreateProductBody`) to avoid Orval TS2308 collision
- TanStack Query v5: QueryClient `retry` is a function that skips retries on 401 (prevents auth-redirect hang)
- Drizzle IN queries: use `inArray(col, ids)` not `sql\`= ANY(${ids})\`` — the raw ANY() form fails at runtime

## Product (Phase 1 MVP — complete)

- Merchant registration & login (JWT auth)
- Product management: create/edit/delete, filter by status/category, stock tracking
- Category management: CRUD
- Order management: create, view detail, update status through 9-stage lifecycle
- Dashboard: revenue KPIs, revenue chart (30 days), order status breakdown, top products, recent orders

## Product (Phase 2 — complete)

- Warehouse management: CRUD, inventory count per warehouse
- Inventory tracking: per-product per-warehouse levels, low-stock alerts, transaction ledger
- Customer management: profiles (firstName/lastName), addresses, order history
- Shipment tracking: carrier/tracking, 7-stage status lifecycle, event timeline
- Nav grouped into: Commerce (Dashboard, Orders, Products, Categories) / Operations (Inventory, Shipments) / Store (Customers)

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- Run `pnpm run typecheck:libs` after any `lib/*` schema change before checking artifact typechecks
- After every OpenAPI spec change, re-run `pnpm --filter @workspace/api-spec run codegen`
- Numeric Drizzle columns return strings — always `parseFloat()` before sending in API responses
- `imageUrl: null` fails Zod validation on product create — omit the field instead of passing null
- Orval overwrites `lib/api-zod/src/index.ts` on each codegen run — the codegen script in `lib/api-spec/package.json` re-writes it to only export `./generated/api` (not `./generated/types`) to prevent TS2308 barrel collision
- Drizzle: use `inArray(col, ids)` not raw `sql\`= ANY()\`` for IN-style queries

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
