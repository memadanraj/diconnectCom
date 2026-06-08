import { pgTable, text, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { productsTable } from "./products";
import { warehousesTable } from "./warehouses";

export const inventoryTable = pgTable("inventory", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  productId: text("product_id").notNull().references(() => productsTable.id),
  warehouseId: text("warehouse_id").notNull().references(() => warehousesTable.id),
  available: integer("available").notNull().default(0),
  reserved: integer("reserved").notNull().default(0),
  damaged: integer("damaged").notNull().default(0),
  returned: integer("returned").notNull().default(0),
  reorderPoint: integer("reorder_point").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const inventoryTransactionsTable = pgTable("inventory_transactions", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  inventoryId: text("inventory_id").notNull().references(() => inventoryTable.id),
  type: text("type").notNull(),
  quantityDelta: integer("quantity_delta").notNull(),
  note: text("note"),
  referenceId: text("reference_id"),
  referenceType: text("reference_type"),
  createdBy: text("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertInventorySchema = createInsertSchema(inventoryTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertInventoryTransactionSchema = createInsertSchema(inventoryTransactionsTable).omit({ id: true, createdAt: true });
export type InsertInventory = z.infer<typeof insertInventorySchema>;
export type InsertInventoryTransaction = z.infer<typeof insertInventoryTransactionSchema>;
export type Inventory = typeof inventoryTable.$inferSelect;
export type InventoryTransaction = typeof inventoryTransactionsTable.$inferSelect;
