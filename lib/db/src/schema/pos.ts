import { pgTable, text, timestamp, numeric, integer, boolean, jsonb } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";
import { branchesTable } from "./branches";
import { customersTable } from "./customers";
import { usersTable } from "./users";

export const registersTable = pgTable("registers", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  branchId: text("branch_id").notNull().references(() => branchesTable.id),
  name: text("name").notNull(),
  status: text("status", { enum: ["open", "closed", "suspended"] }).notNull().default("closed"),
  openedBy: text("opened_by").references(() => usersTable.id),
  openedAt: timestamp("opened_at", { withTimezone: true }),
  openingCash: numeric("opening_cash", { precision: 12, scale: 2 }).default("0"),
  closedBy: text("closed_by").references(() => usersTable.id),
  closedAt: timestamp("closed_at", { withTimezone: true }),
  closingCash: numeric("closing_cash", { precision: 12, scale: 2 }),
  expectedCash: numeric("expected_cash", { precision: 12, scale: 2 }),
  cashVariance: numeric("cash_variance", { precision: 12, scale: 2 }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const posSalesTable = pgTable("pos_sales", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  registerId: text("register_id").notNull().references(() => registersTable.id),
  customerId: text("customer_id").references(() => customersTable.id),
  items: jsonb("items").notNull().default([]),
  subtotal: numeric("subtotal", { precision: 12, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 12, scale: 2 }).notNull().default("0"),
  tax: numeric("tax", { precision: 12, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 12, scale: 2 }).notNull(),
  paymentMethod: text("payment_method", { enum: ["cash", "card", "esewa", "khalti", "mixed"] }).notNull(),
  payments: jsonb("payments").default([]),
  changeGiven: numeric("change_given", { precision: 12, scale: 2 }).default("0"),
  loyaltyPointsEarned: integer("loyalty_points_earned").default(0),
  loyaltyPointsRedeemed: integer("loyalty_points_redeemed").default(0),
  notes: text("notes"),
  status: text("status", { enum: ["completed", "voided", "refunded"] }).notNull().default("completed"),
  syncedAt: timestamp("synced_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const cashMovementsTable = pgTable("cash_movements", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  registerId: text("register_id").notNull().references(() => registersTable.id),
  type: text("type", { enum: ["in", "out"] }).notNull(),
  amount: numeric("amount", { precision: 12, scale: 2 }).notNull(),
  reason: text("reason"),
  performedBy: text("performed_by").references(() => usersTable.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Register = typeof registersTable.$inferSelect;
export type PosSale = typeof posSalesTable.$inferSelect;
export type CashMovement = typeof cashMovementsTable.$inferSelect;
