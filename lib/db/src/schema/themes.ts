import { pgTable, text, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { tenantsTable } from "./tenants";

export const themesTable = pgTable("themes", {
  id: text("id").primaryKey().$defaultFn(() => crypto.randomUUID()),
  tenantId: text("tenant_id").notNull().references(() => tenantsTable.id),
  name: text("name").notNull(),
  draftJson: jsonb("draft_json").notNull().default({}),
  publishedJson: jsonb("published_json").default({}),
  isPublished: boolean("is_published").notNull().default(false),
  publishedAt: timestamp("published_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export type Theme = typeof themesTable.$inferSelect;
