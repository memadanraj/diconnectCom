import { pgTable, text, timestamp, numeric, integer } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const returnsTable = pgTable("returns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  returnNumber: text("return_number").notNull(),
  orderId: text("order_id").notNull(),
  orderNumber: text("order_number"),
  customerName: text("customer_name"),
  customerEmail: text("customer_email"),
  status: text("status", {
    enum: ["requested", "approved", "rejected", "received", "refunded", "closed"],
  }).notNull().default("requested"),
  reason: text("reason", {
    enum: ["defective", "wrong_item", "not_as_described", "changed_mind", "duplicate_order", "other"],
  }).notNull(),
  notes: text("notes"),
  refundAmount: numeric("refund_amount", { precision: 10, scale: 2 }).notNull().default("0"),
  refundMethod: text("refund_method", { enum: ["original_payment", "store_credit", "bank_transfer"] }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const returnItemsTable = pgTable("return_items", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  returnId: text("return_id").notNull().references(() => returnsTable.id),
  orderItemId: text("order_item_id"),
  productId: text("product_id"),
  productName: text("product_name").notNull(),
  sku: text("sku"),
  quantity: integer("quantity").notNull().default(1),
  unitPrice: numeric("unit_price", { precision: 10, scale: 2 }).notNull(),
  reason: text("reason"),
  condition: text("condition", { enum: ["unopened", "opened", "damaged"] }),
});

export type Return = typeof returnsTable.$inferSelect;
export type ReturnItem = typeof returnItemsTable.$inferSelect;
