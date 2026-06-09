---
name: Drizzle inArray vs ANY
description: Raw sql`= ANY(${ids})` fails at runtime in Drizzle ORM; use inArray() instead.
---

The rule: for IN-style queries over an array of IDs, use `inArray(col, ids)` from `drizzle-orm`.

**Why:** `sql\`${col} = ANY(${ids})\`` fails at runtime with a Drizzle parameterization error when `ids` is a JavaScript array. The `inArray` helper generates the correct `= ANY($1)` with a proper array binding.

**How to apply:** Import `inArray` from `drizzle-orm` and replace `sql\`... = ANY(${ids})\`` with `inArray(table.col, ids)`. Always check for this pattern when writing queries that filter by a list of IDs (e.g. joining item counts to order rows).
