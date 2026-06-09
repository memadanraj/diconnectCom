import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { customersTable } from "./customers";

export const loyaltyAccountsTable = pgTable("loyalty_accounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  points: integer("points").notNull().default(0),
  lifetimePoints: integer("lifetime_points").notNull().default(0),
  tier: text("tier", { enum: ["bronze", "silver", "gold", "platinum"] }).notNull().default("bronze"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const loyaltyTransactionsTable = pgTable("loyalty_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  customerId: text("customer_id").notNull().references(() => customersTable.id),
  type: text("type", { enum: ["earn", "redeem", "expire", "adjust"] }).notNull(),
  points: integer("points").notNull(),
  referenceType: text("reference_type"),
  referenceId: text("reference_id"),
  note: text("note"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type LoyaltyAccount = typeof loyaltyAccountsTable.$inferSelect;
export type LoyaltyTransaction = typeof loyaltyTransactionsTable.$inferSelect;
