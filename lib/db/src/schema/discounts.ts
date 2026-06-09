import { pgTable, text, timestamp, numeric, integer, boolean } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const discountsTable = pgTable("discounts", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  code: text("code").notNull(),
  description: text("description"),
  type: text("type", { enum: ["percentage", "fixed", "free_shipping"] }).notNull(),
  value: numeric("value", { precision: 10, scale: 2 }).notNull().default("0"),
  minOrderAmount: numeric("min_order_amount", { precision: 10, scale: 2 }),
  maxDiscountAmount: numeric("max_discount_amount", { precision: 10, scale: 2 }),
  usageLimit: integer("usage_limit"),
  usageCount: integer("usage_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const discountUsagesTable = pgTable("discount_usages", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  discountId: text("discount_id").notNull().references(() => discountsTable.id),
  orderId: text("order_id").notNull(),
  discountAmount: numeric("discount_amount", { precision: 10, scale: 2 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Discount = typeof discountsTable.$inferSelect;
export type DiscountUsage = typeof discountUsagesTable.$inferSelect;
