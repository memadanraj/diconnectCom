import { pgTable, text, timestamp, jsonb, integer } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const campaignsTable = pgTable("campaigns", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  description: text("description"),
  type: text("type", {
    enum: ["flash_sale", "bundle_discount", "free_shipping", "loyalty_reward", "referral", "win_back", "birthday"],
  }).notNull(),
  status: text("status", { enum: ["draft", "active", "paused", "ended"] }).notNull().default("draft"),
  targetSegmentId: text("target_segment_id"),
  discountId: text("discount_id"),
  conditions: jsonb("conditions"),
  startsAt: timestamp("starts_at", { withTimezone: true }),
  endsAt: timestamp("ends_at", { withTimezone: true }),
  audienceCount: integer("audience_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Campaign = typeof campaignsTable.$inferSelect;
