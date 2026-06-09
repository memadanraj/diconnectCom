import { pgTable, text, timestamp, jsonb, boolean } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const segmentsTable = pgTable("segments", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", { enum: ["static", "dynamic"] }).notNull().default("static"),
  conditions: jsonb("conditions"),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const segmentMembersTable = pgTable("segment_members", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  segmentId: text("segment_id").notNull().references(() => segmentsTable.id),
  customerId: text("customer_id").notNull(),
  addedAt: timestamp("added_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Segment = typeof segmentsTable.$inferSelect;
export type SegmentMember = typeof segmentMembersTable.$inferSelect;
