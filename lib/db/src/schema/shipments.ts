import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { tenantsTable } from "./tenants";
import { ordersTable } from "./orders";

export const shipmentsTable = pgTable("shipments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  orderId: text("order_id").notNull().references(() => ordersTable.id),
  trackingNumber: text("tracking_number"),
  carrier: text("carrier"),
  status: text("status").notNull().default("pending"),
  estimatedDelivery: timestamp("estimated_delivery", { withTimezone: true }),
  deliveredAt: timestamp("delivered_at", { withTimezone: true }),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const shipmentEventsTable = pgTable("shipment_events", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  shipmentId: text("shipment_id").notNull().references(() => shipmentsTable.id),
  status: text("status").notNull(),
  description: text("description"),
  location: text("location"),
  occurredAt: timestamp("occurred_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertShipmentSchema = createInsertSchema(shipmentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export const insertShipmentEventSchema = createInsertSchema(shipmentEventsTable).omit({ id: true });
export type InsertShipment = z.infer<typeof insertShipmentSchema>;
export type InsertShipmentEvent = z.infer<typeof insertShipmentEventSchema>;
export type Shipment = typeof shipmentsTable.$inferSelect;
export type ShipmentEvent = typeof shipmentEventsTable.$inferSelect;
